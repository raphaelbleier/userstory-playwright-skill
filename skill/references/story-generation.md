# Deriving user stories from a codebase

## What a good story is

```
As a <role>, I want <goal>, so that <benefit>.
```

The three parts are not decoration. If you cannot name the benefit, you have described a UI
element, not a story. "As a user, I want to click the submit button" is not a story — clicking is
a step, not a goal.

INVEST is the filter:

- **Independent** — testable without another story having run first (use `preconditions` for
  genuine setup, not for chaining stories)
- **Negotiable** — describes intent, not implementation
- **Valuable** — a human somewhere cares about the outcome
- **Estimable** — small enough to reason about
- **Small** — one flow, not a whole feature area
- **Testable** — this is the one that matters here. If you cannot write a Playwright assertion
  for it, rewrite it until you can.

"As a visitor, I want the site to feel fast" fails Testable. "As a visitor, I want the product
list to render within 2 seconds on a cold load" passes.

## Where stories come from in code

Work outside-in. The user-facing surface is what users have stories about.

| Look at | Yields |
|---|---|
| Router / route files / `pages/` / `app/` | one story per meaningful page-level goal |
| Forms (`<form>`, form libraries, validation schemas) | one happy-path story + one story per *distinct* validation rule the user can hit |
| Auth: login, register, logout, password reset, guards/middleware | stories per flow, plus access-control stories ("as an anonymous visitor, I cannot reach /admin") |
| Navigation, headers, footers | wayfinding stories — usually low priority, generate few |
| Buttons/actions that mutate state (create, delete, submit, purchase) | one story each, these are usually `Must` |
| Empty states, error states, loading states | edge-case stories, `Could` unless the app is data-heavy |
| Role checks / permission logic | one story per role boundary — these are frequently where real bugs live |

## Roles

Read them out of the code, do not invent them. The auth model tells you: an app with
`role: 'admin' | 'user'` and public pages has three roles — anonymous visitor, user, admin.
Every story's `role` must be one of the roles the app actually has.

## Acceptance criteria

Given / When / Then, one clause each, newline-separated. Concrete values, not placeholders.

Good:

```
Given I am logged in as a user with an empty cart
When I click "Add to cart" on the product "Blue Mug"
Then the cart badge shows 1 and the cart contains "Blue Mug"
```

Bad — untestable, no observable outcome:

```
Given I am a user
When I use the cart
Then it works
```

The Then clause must name something you can assert on: a URL, visible text, an element's state,
a count. If the Then clause is vague, the spec you write from it will be vague, and a vague spec
either passes when it shouldn't or fails for the wrong reason.

## Priority (MoSCoW)

- `Must` — the app is pointless without it (login, checkout, the core action)
- `Should` — important, but the app still delivers value without it
- `Could` — nice to have
- `Wont` — out of scope for now; generate these only if the user asks for a complete map

Be honest. If everything is `Must`, nothing is.

## Provenance

Fill `sourceFiles` with the files you actually read to derive the story. This is what lets the
user check your work, and it is what makes the sheet re-generatable when the code changes.
Comma-separated relative paths.

## Optional: crawl enrichment

If the user provides a running `baseURL`, visit the pages you found in the code and check:

- the route actually resolves (a route in the code that 404s is worth reporting immediately)
- the form fields you inferred are really there, and what their accessible names are
- what the real success state looks like (redirect target, toast text, rendered content)

This makes the acceptance criteria concrete and the resulting selectors stable. Record the real
accessible names in the criteria — `Then I see "Welcome back, Alice"` beats
`Then I see a greeting`.

Without a `baseURL`, derive from code and accept that the first `run` will need a round of spec
fixing. That is normal and is what triage is for.

## Scope

Before writing `stories.json`, show the user what you found and how many stories it implies, then
ask. Their app, their call. Never cap silently.
