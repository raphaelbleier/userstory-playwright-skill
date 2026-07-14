/**
 * Demo app under test. Small on purpose.
 *
 * It contains exactly ONE deliberate bug, so the skill has something real to find:
 * the contact form's email validation only checks that the field is non-empty, so an
 * address with no "@" is accepted and stored. See `isValidEmail` below.
 *
 * Do not "fix" it — the CI test asserts the skill reports it.
 */
import express from 'express';

const app = express();
app.use(express.urlencoded({ extended: false }));

const USER = { email: 'alice@example.com', password: 'correct-horse-1' };
const leads = [];

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
<body>
  <header><a href="/">Demo Shop</a> <nav><a href="/contact">Contact</a> <a href="/login">Log in</a></nav></header>
  <main>${body}</main>
</body></html>`;

const isLoggedIn = (req) => (req.headers.cookie ?? '').includes('session=ok');

app.get('/', (_req, res) => {
  res.send(page('Demo Shop', '<h1>Demo Shop</h1><p>Welcome to the demo shop.</p>'));
});

app.get('/login', (_req, res) => {
  res.send(
    page(
      'Log in',
      `<h1>Log in</h1>
       <form method="post" action="/login">
         <label for="email">Email</label><input id="email" name="email" type="text">
         <label for="password">Password</label><input id="password" name="password" type="password">
         <button type="submit">Log in</button>
       </form>`,
    ),
  );
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === USER.email && password === USER.password) {
    res.setHeader('Set-Cookie', 'session=ok; Path=/');
    return res.redirect('/dashboard');
  }
  res.status(401).send(
    page(
      'Log in',
      `<h1>Log in</h1>
       <p role="alert">Invalid email or password.</p>
       <form method="post" action="/login">
         <label for="email">Email</label><input id="email" name="email" type="text">
         <label for="password">Password</label><input id="password" name="password" type="password">
         <button type="submit">Log in</button>
       </form>`,
    ),
  );
});

app.get('/dashboard', (req, res) => {
  if (!isLoggedIn(req)) return res.redirect('/login');
  res.send(page('Dashboard', `<h1>Dashboard</h1><p>Signed in as ${USER.email}</p>`));
});

app.get('/contact', (_req, res) => {
  res.send(
    page(
      'Contact',
      `<h1>Contact us</h1>
       <form method="post" action="/contact">
         <label for="cemail">Email</label><input id="cemail" name="email" type="text">
         <label for="message">Message</label><textarea id="message" name="message"></textarea>
         <button type="submit">Send message</button>
       </form>`,
    ),
  );
});

// THE BUG: "valid" means "not empty". An address with no @ sails straight through.
const isValidEmail = (value) => typeof value === 'string' && value.trim().length > 0;

app.post('/contact', (req, res) => {
  const { email, message } = req.body;
  if (!isValidEmail(email)) {
    return res
      .status(400)
      .send(page('Contact', '<h1>Contact us</h1><p role="alert">Please enter a valid email address.</p>'));
  }
  leads.push({ email, message });
  res.send(page('Contact', '<h1>Contact us</h1><p role="status">Thanks, we will be in touch.</p>'));
});

const port = Number(process.env.PORT ?? 3100);
app.listen(port, () => console.log(`demo app on http://localhost:${port}`));
