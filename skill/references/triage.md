# Triage: a red test is not a bug

Most first-run failures in a generated suite are the suite's fault, not the app's. Reporting
those as bugs destroys the sheet's credibility — and a QA report nobody trusts is worse than no
report. Triage exists to make the distinction.

For each failing story, work through this in order.

## 1. Look at the evidence

Do not judge from the error string alone. It tells you the symptom, not the cause.

```bash
npx playwright show-trace test-results/<dir>/trace.zip
```

The trace has the DOM at the moment of failure, the network log, the console, and the action
timeline. The screenshot shows what the user would have seen. Between them, you can almost always
see what actually happened.

## 2. Classify

### Bad spec — your fault, not the app's

Signals:

- `locator resolved to 0 elements`, but the trace's DOM snapshot shows the element is right
  there under a different accessible name
- the failure is a timeout, and the trace shows the app finished the action afterwards
- passes when re-run alone, fails in parallel
- the selector was a class name or a positional path

**Action:** fix the spec. Re-run just that story:

```bash
npx playwright test --grep @US-007
```

Then re-sync. Do **not** write a bug. This is the most common outcome on a first run and it is
not a finding.

### Wrong story — the story describes something the app never did

Signals:

- the route 404s; there is no such page
- the acceptance criteria assume a field, button or flow that does not exist in the code
- the app deliberately behaves differently (and the code says so)

**Action:** correct the story text, set Status `blocked`, and put the reason in Bug / Root Cause.
This is a finding, but about the story, not the app. Note it and move on — do not "fix" the app
to match a story you invented.

### Real bug — the app is wrong

Signals:

- the app's own code confirms the broken behaviour when you read it
- the observed behaviour contradicts the app's stated intent (its own validation schema, its
  types, its comments, its other code paths)
- data is accepted that should be rejected, or rejected that should be accepted
- a permission boundary does not hold

**Action:** record it. Severity, and a root cause that names the cause.

## 3. Write a real root cause

The root cause must survive being read by someone who was not there. It names the mechanism, and
where it lives.

Not a root cause — this is just the assertion, restated:

> Expected URL to be /dashboard, received /login

A root cause:

> After a successful login the session cookie is set without a `Path` attribute, so the browser
> scopes it to `/api/` and does not send it on the redirect to `/dashboard`. The dashboard's
> middleware sees no session and bounces back to `/login`. `src/api/login.ts:42` — the `Set-Cookie`
> is missing `path: '/'`.

If you cannot determine the cause without guessing, say that explicitly:

> The form silently does nothing on submit. No network request is made and no console error is
> emitted. The submit handler in `ContactForm.tsx:88` is bound but the cause of the no-op is not
> apparent from the trace — needs a debugger session.

An honest "I don't know yet" is useful. A confident wrong answer is not.

## 4. Severity

Impact on the user. Independent of the story's Priority — a trivial bug in a `Must` story is
still trivial, and a blocker in a `Could` story is still a blocker.

| | |
|---|---|
| `S1-Blocker` | Core flow unusable, no workaround. Nobody can log in. Checkout dies. |
| `S2-Critical` | Major function broken, or data integrity / security at risk. Invalid data reaches the database. A permission boundary leaks. |
| `S3-Major` | A feature is broken, but there is a workaround. |
| `S4-Minor` | Cosmetic, or an edge case few users hit. |
| `S5-Trivial` | Nitpick. Wrong padding. A typo. |

Security and data-integrity failures are `S2` at minimum, even when they look small. An email
field that accepts garbage is not cosmetic — it writes garbage to the database.

## 5. Flaky

Status `flaky` means it passed on retry. Do not report it as a bug and do not ignore it. Find out
which it is:

```bash
npx playwright test --grep @US-007 --repeat-each 5
```

- Fails intermittently → usually a race in the spec (a missing wait, a shared fixture). Fix the
  spec.
- Fails intermittently *in the app* (a race condition, a slow query timing out under load) →
  that is a real bug, and often a serious one. Record it, and say in the root cause that it is
  intermittent and at what rate.

## Output

```json
{
  "triage": [
    {
      "id": "US-007",
      "severity": "S2-Critical",
      "rootCause": "The contact form accepts an email address with no @ sign. The client-side check in ContactForm.tsx:34 only tests `value.length > 0`, and the POST /api/contact handler never re-validates. Invalid addresses are written straight to the leads table, so the follow-up mail silently bounces.",
      "status": "fail"
    },
    {
      "id": "US-011",
      "status": "blocked",
      "rootCause": "The story assumes a password-reset flow. There is no reset route in the codebase and no mailer configured. The story was derived from a 'Forgot password?' link that points to /#."
    }
  ]
}
```

Stories you fixed the spec for do not appear in `triage.json` at all — re-running them and
letting `--results` turn them green is the record.
