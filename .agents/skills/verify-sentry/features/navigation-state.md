# Navigation and state

Users move around onboarding with the in-app `Back` button, the browser's back and forward buttons, a platform change, a reload, or a link opened in another tab. Each move must keep the onboarding project and its DSN, which the user may already have pasted into their app, and must never leave a second project behind.

## Claims

- `inapp-back-keeps-project` keeps the onboarding project, its slug, and its DSN when the user chooses `Back` on the setup docs. Proof: `drive`. Fails today (proof2): the project goes to `Pending Deletion` and its slug is replaced by a random hex string.
- `browser-back-keeps-project` keeps the onboarding project and its DSN when the user presses the browser back button on the setup docs. Proof: `drive`. Fails today (proof2): same deletion as `inapp-back-keeps-project`.
- `back-continue-same-dsn` returns to the same project and DSN when the user goes back and chooses `Continue` with the same platform. Proof: `drive`. Fails today (proof2): a new project with a new DSN replaces the deleted one, so a DSN the user already copied stops working.
- `forward-shows-live-dsn` shows the DSN of an active project when the user presses browser forward back onto the setup docs. Proof: `drive`. Fails today (proof2): the page shows the DSN of the deleted project, and `GET /api/0/projects/<org>/javascript-react/overview/` returns `404` on every poll.
- `platform-change-no-duplicate` leaves one onboarding project when the user goes back and picks a different platform, so going back to platform selection never adds a second project. Proof: `drive`. Fails today (proof2): after a first event, going back and picking Vue leaves `javascript-react` active and adds `javascript-vue`.
- `refresh-keeps-docs` shows the same project and DSN after a reload of the setup docs. Proof: `drive`.
- `deeplink-resumes` resumes the org's onboarding project when the setup-docs URL opens in a fresh tab or browser, and never creates a second project for the same journey. Proof: `drive`. Fails today (proof2): the fresh session redirects to `welcome/`, and repeating the manual steps creates `javascript-react-xl` next to `javascript-react`.

## How to get to it

- In-app `Back` (`[aria-label="Back"]`) on `setup-docs/` and `scm-platform-features/`.
- Browser back and forward on any step.
- Reload on any step.
- Pasting `/onboarding/<org>/setup-docs/?product=error-monitoring` into a new tab or browser.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. Each bullet uses its own fresh org `O`, and runs the shared recipe in `README.md` first so the page shows `Configure React SDK`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/navigation-state`. Save `$ST $O --out $EV/<claim>-before.json` on the setup docs, and call its project ID `P` and DSN `D`.
- `DSN_JS="(document.body.innerText.match(/dsn: \"([^\"]+)\"/)||[])[1]"`.

- **`inapp-back-keeps-project`, `back-continue-same-dsn`: in-app back.** `$A find role button click --name "Back" --exact`, then `$A wait '[data-test-id="onboarding-step-scm-platform-features"]'` and `sleep 2`. `$ST $O --out $EV/inapp-back-after-back.json` must show `P` `Active` with slug `javascript-react`. Then `$A find role button click --name "Continue" --exact` and `$A wait --text "Configure React SDK"`. `$ST $O --out $EV/inapp-back-after-continue.json` must show only `P` with DSN `D`, and `$A eval "$DSN_JS"` must print `D`.
- **`browser-back-keeps-project`, `forward-shows-live-dsn`: browser back and forward.** `$A back`, `sleep 4`. The URL ends in `/scm-platform-features/`. `$ST $O --out $EV/browser-back-after-back.json` must show `P` `Active`. Then `$A forward`, `sleep 4`. The page shows `Configure React SDK`; `$A eval "$DSN_JS"` must print the DSN of an `Active` project in `state`, and `$A network requests --filter overview` must show no `404`.
- **`platform-change-no-duplicate`: change platform after a first event.** Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py event $O javascript-react` and `$A wait --text "Error Received"`. `$A find role button click --name "Back" --exact`, pick Vue with the platform combobox, `$A find role button click --name "Continue" --exact`, and `$A wait --text "Configure Vue SDK"`. `$ST $O --out $EV/platform-change.json` must list exactly one `Active` project. Repeat without the first event: the result must still be one `Active` project.
- **`refresh-keeps-docs`: reload.** `$A reload`, then `$A wait --text "Configure React SDK"` and `sleep 2`. The URL is unchanged, `$A eval "$DSN_JS"` prints `D`, and `state` still shows only `P`.
- **`deeplink-resumes`: fresh session.** `URL=$($A get url)`. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py login owner --session verify-sentry-owner-2`, then `agent-browser --session verify-sentry-owner-2 open "$URL"` and `sleep 6`. The page must show `Configure React SDK` with DSN `D`. If it lands elsewhere, record the URL, finish the shared recipe in that session with React, and record `state`: it must still list only `P`.

## Gotchas

- Deletion is asynchronous: `state` shows `Pending Deletion` and a renamed slug right away, and the row disappears later. Compare project IDs, not slugs.
- Back deletes only an "inactive" project: no first event and less than an hour old. Send a first event when a claim needs an active project.
- These acceptance tests assert today's deletion behavior, which these claims reject: `tests/acceptance/test_onboarding.py::OnboardingTest::test_scm_back_from_setup_docs_control_non_active_project`, `::test_skip_after_going_back_deletes_projects`, `::test_scm_back_from_setup_docs_control_active_project_platform_changed`, and `tests/acceptance/test_create_project.py::CreateProjectTest::test_project_deletion_on_going_back`. A fix for these claims has to change those tests too.
- Onboarding state lives in one `sessionStorage` entry named `onboarding` that is not scoped by org. Reusing one tab across orgs can carry state between them; open each org fresh, or run `$A eval "sessionStorage.clear()"` first.
- Members behave the same here: in proof2 a member's `Back` deleted the project too (`DELETE /api/0/projects/<org>/javascript-react/` returned `204`).

## Gaps

None.
