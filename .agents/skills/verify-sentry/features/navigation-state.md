# Navigation and state

Users move around onboarding with the in-app `Back` button, the browser's back and forward buttons, a platform change, a reload, or a link opened in another tab. Each move keeps the onboarding project and its DSN, which the user may already have pasted into their app, and never leaves a second project behind.

## Sub-features

- `inapp-back-keeps-project` keeps the onboarding project and its DSN when the user chooses `Back` on the setup docs, and `Continue` with the same platform returns to that DSN.
- `browser-back-forward-keeps-project` keeps the onboarding project when the user presses browser back on the setup docs, and browser forward shows the DSN of a live project.
- `platform-change-no-duplicate` leaves one onboarding project when the user goes back and picks a different platform.
- `refresh-keeps-docs` shows the same project and DSN after a reload of the setup docs.
- `deeplink-resumes` resumes the org's onboarding project when the setup-docs URL opens in a fresh tab or browser, and never creates a second project for the same journey.

## How to get to it (user POV)

- In-app `Back` on `setup-docs/` and `scm-platform-features/`.
- Browser back and forward on any step.
- Reload on any step.
- Pasting `/onboarding/<org>/setup-docs/?product=error-monitoring` into a new tab or browser.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. Each bullet uses its own fresh org `O`, and runs the shared recipe in `README.md` first so the page shows `Configure React SDK`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/navigation-state`. Save `$ST $O --out $EV/<sub-feature>-before.json` on the setup docs, and call its project ID `P` and DSN `D`.
- `DSN_JS="(document.body.innerText.match(/dsn: \"([^\"]+)\"/)||[])[1]"`.

- **`inapp-back-keeps-project`: in-app back.** `$A find role button click --name "Back" --exact`, then `$A wait '[data-test-id="onboarding-step-scm-platform-features"]'` and `sleep 2`. `$ST $O --out $EV/inapp-back-after-back.json` shows `P` `Active` with slug `javascript-react`. Then `$A find role button click --name "Continue" --exact` and `$A wait --text "Configure React SDK"`. `$ST $O --out $EV/inapp-back-after-continue.json` shows only `P` with DSN `D`, and `$A eval "$DSN_JS"` prints `D`.
- **`browser-back-forward-keeps-project`: browser back and forward.** `$A back`, `sleep 4`. The URL ends in `/scm-platform-features/`. `$ST $O --out $EV/browser-back-after-back.json` shows `P` `Active`. Then `$A forward`, `sleep 4`. The page shows `Configure React SDK`, and `$A eval "$DSN_JS"` prints the DSN of an `Active` project in `state`.
- **`platform-change-no-duplicate`: change platform.** Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py event $O javascript-react` and `$A wait --text "Error Received"`. `$A find role button click --name "Back" --exact`, pick Vue with the platform combobox, `$A find role button click --name "Continue" --exact`, and `$A wait --text "Configure Vue SDK"`. `$ST $O --out $EV/platform-change.json` lists exactly one `Active` project. Repeat on another fresh org without the first event: still one `Active` project.
- **`refresh-keeps-docs`: reload.** `$A reload`, then `$A wait --text "Configure React SDK"` and `sleep 2`. The URL is unchanged, `$A eval "$DSN_JS"` prints `D`, and `state` still shows only `P`.
- **`deeplink-resumes`: fresh session.** `URL=$($A get url)`. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py login owner --session verify-sentry-owner-2`, then `agent-browser --session verify-sentry-owner-2 open "$URL"` and `sleep 6`. The page shows `Configure React SDK` with DSN `D`. If it lands elsewhere, record the URL, finish the shared recipe in that session with React, and record `state`: it lists only `P`.

## Gotchas

- Project deletion is asynchronous: `state` shows `Pending Deletion` and a renamed slug right away, and the row disappears later. Compare project IDs, not slugs.
- A project with a first event or older than an hour is treated differently from a fresh one on back. Send a first event when a recipe calls for one, and use a fresh org otherwise.
- Onboarding progress is kept per browser tab, not per org. Reusing one tab across orgs can carry state between them; open each org fresh, or run `$A eval "sessionStorage.clear()"` first.
- Members go through the same steps. Repeat a bullet with `$M` when a change touches member permissions.
