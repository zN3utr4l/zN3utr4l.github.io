# zN3utr4l.github.io

The public GitHub Pages site for Giuseppe Chirico's Android apps: the personal
landing, plus the pages Google Play links from each listing — app description,
privacy policy, community documents, account deletion — and the Android App
Links trust file. App source lives in the separate `Carburo` and `PumpLog`
repositories; only their public face lives here. Static HTML/CSS with one tested
Node generator: no build step, no framework, no package dependency tree. Pages
are Italian (`lang="it"`) and so are the generator's comments; keep a file in
the language it already uses and write commits and instructions in English.
There are no topical guides: the authoritative source for a rule is the file
that owns it — the generator, the workflow, or the legal page itself.

## Structure

| Path | Owns |
|---|---|
| [`index.html`](index.html) | Personal landing, one self-contained file with inline CSS. |
| `Carburo/` | [app page](Carburo/index.html), [`privacy.html`](Carburo/privacy.html), `style.css`, and the generated [`prezzi/index.html`](Carburo/prezzi/index.html). |
| `PumpLog/` | [app landing](PumpLog/index.html), [`privacy.html`](PumpLog/privacy.html), [`community-terms.html`](PumpLog/community-terms.html), [`community-rules.html`](PumpLog/community-rules.html), [`delete-account.html`](PumpLog/delete-account.html), `style.css`, [`sw.js`](PumpLog/sw.js). |
| [`.well-known/assetlinks.json`](.well-known/assetlinks.json) | Android App Links trust contract for `io.github.zn3utr4l.pumplog`. |
| [`scripts/build-prezzi.mjs`](scripts/build-prezzi.mjs) | Sole owner of `Carburo/prezzi/index.html`, tested by [`build-prezzi.test.mjs`](scripts/build-prezzi.test.mjs). |
| [`.github/workflows/prezzi.yml`](.github/workflows/prezzi.yml) | Daily test, regeneration and commit of the price page. |
| `.nojekyll` | Serves the tree as it is, without Jekyll. |

`PumpLog/index.html` is also the App Link landing: it reads `join`, `partner`
and `auth=google` from the query string, shows the matching notice and offers an
`intent://` fallback into the app. `PumpLog/sw.js` is a kill-switch that
unregisters the retired PWA service worker and clears its caches; keep it
deployed indefinitely, or those browsers keep serving the old shell instead of
the legal pages.

## Commands

```powershell
node --test scripts/build-prezzi.test.mjs
node scripts/build-prezzi.mjs
```

The first is the routine check and the only one: Node 24, no install step. The
second is a networked, mutating regeneration command, not a test — it fetches
the MIMIT CSV and rewrites `Carburo/prezzi/index.html`. Run it only when you
mean to regenerate the page, never as verification.

## Always preserve

- `.well-known/assetlinks.json` is a trust contract, not configuration. Its two
  SHA-256 fingerprints are the upload key and the Play app-signing key: never
  guess a fingerprint, drop one, or reformat the file casually — PumpLog's App
  Links and its in-app Google sign-in break silently.
- `Carburo/prezzi/index.html` is generated. Change it through
  `scripts/build-prezzi.mjs` only; a hand edit is overwritten by the next run.
- The generator validates before writing: a CSV without the `REGIONE;` header or
  without a single valid price makes it throw and write nothing, so yesterday's
  page — which carries its own date in plain text — stays online. A failed run
  is not an incident to route around, and must never become an empty page or
  invented numbers.
- The prices belong in the HTML body, not in a script: the page exists to be
  read by search engines without executing JavaScript.
- `.github/workflows/prezzi.yml` runs the parser test, regenerates, and commits
  only when the numbers really changed. Keep the test step before the generator.
- A public or legal page must stay true to the shipped app. When app behavior
  changes around data collection, social features, backup, account deletion,
  App Links or external providers, correct the matching page in the same change
  and update its visible last-updated date: `Carburo/privacy.html`,
  `PumpLog/privacy.html`, `PumpLog/community-terms.html`,
  `PumpLog/community-rules.html`, `PumpLog/delete-account.html`.
- No dependency, bundler or extra generator: static HTML/CSS needs none, and a
  package tree here would be maintenance without a user.

## Verification

- Parser or generator work: update `scripts/build-prezzi.test.mjs` first, then
  the code. That test is what stops a changed CSV format from publishing a wrong
  page, so it must fail before the fix and pass after it.
- HTML or CSS work: there is no build to fail, so read the page you changed and
  check that relative links (`../style.css`, `privacy.html`, `prezzi/`) resolve
  from the served path and not only on disk.
- Everything committed here is public as soon as it reaches `main`: never add a
  key, a service-account file, real user data, or a draft you would not want
  indexed.

## Git and synchronization

- Human changes go through a pull request by convention, not by enforcement:
  `main` carries no branch protection here, so branch, push, open the pull
  request and merge it yourself once the checks you care about are green. Commit
  as `zN3utr4l`, and run `gh auth switch --user zN3utr4l` before any push.
- The one direct push to `main` is automated: `.github/workflows/prezzi.yml`
  commits and pushes its own `chore(prezzi): …` commit as `github-actions[bot]`.
  Leave that exception alone, `git fetch` and start from the fetched state, and
  never force-push over it.
- `CLAUDE.md` is canonical and `AGENTS.md` is its byte-identical copy. This
  repository has no hook to mirror them: every change to this file must update
  both copies, byte for byte, in the same commit.
