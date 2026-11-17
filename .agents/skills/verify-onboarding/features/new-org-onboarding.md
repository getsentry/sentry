# New org onboarding

A user in an org with no projects goes through `/onboarding/<org>/`: welcome, connect a repo or skip it, pick a platform and products, land on the setup docs with a working project and DSN, and finish when the first error arrives. The agent path that starts on the same welcome page is in `agent-handoff.md`.

## Claims

- `welcome-choices` shows both ways to start on welcome: the agent card with `Copy agent prompt`, and `Prefer to do it yourself? Set up manually`. Proof: `drive`.
- `scm-connect-providers` lists GitHub, GitLab, and Bitbucket on the connect step, with `Continue without a repo` to go on without one. Proof: `drive`.
- `scm-connect-install` installs a GitHub integration from the connect step, lists its repos, and uses the chosen repo to detect the platform. Proof: `test` with `.venv/bin/pytest tests/acceptance/test_onboarding.py::OnboardingTest::test_scm_onboarding_with_integration_install`.
- `scm-reload-restores-repo` keeps the connected repo selected after a reload of the connect step. Proof: `test` with `.venv/bin/pytest tests/acceptance/test_onboarding.py::OnboardingTest::test_scm_onboarding_reload_restores_connected_repo`.
- `platform-creates-project` creates exactly one active project for the chosen platform, with a DSN, when the user chooses `Continue` on the platform step, and opens its setup docs. Proof: `drive`.
- `first-event-lands-on-issue` turns `Waiting for error` into `Error Received` when an SDK sends the first error with the shown DSN, and `Take me to my error` opens that issue. Proof: `drive`.
- `member-new-org` lets a member of a new org copy an agent prompt and create the first project on the manual path. Proof: `drive`.

## How to get to it

- Create an org, which redirects to `/onboarding/<org>/welcome/`.
- Open `/onboarding/<org>/` directly; it redirects to `welcome/`.
- Steps by URL: `welcome/`, `scm-connect/`, `scm-platform-features/`, `scm-messaging/` (only with `--flags …,messaging`), `setup-docs/`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. `O` is an unused entry of `new_orgs`.
- `EV=$PWD/.artifacts/verify-onboarding/<run-id>/new-org-onboarding`.

- **`welcome-choices`: welcome.** `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, then wait for the prompt as in `README.md`. `snapshot -i` lists heading `Let your agent set up Sentry`, button `Copy agent prompt` (enabled), and button `Prefer to do it yourself? Set up manually`.
- **`scm-connect-providers`: connect step.** Click `[data-test-id="onboarding-setup-in-browser"]`, then `$A wait --text "Continue without a repo"`. `snapshot -i` lists buttons `Add GitHub`, `Add GitLab`, `Add Bitbucket`, `More providers`, `Back`, `Continue without a repo`, and a disabled `Continue`.
- **`platform-creates-project`: pick React.** Finish the shared recipe in `README.md`. The URL ends in `/setup-docs/?product=error-monitoring`. `$ST $O --out $EV/platform-creates-project.json` shows one project, `javascript-react`, status `Active`, `first_event: null`, with one DSN.
- **`first-event-lands-on-issue`: first error.** `snapshot` contains `Waiting for error`. Run `.venv/bin/python .agents/skills/verify-onboarding/scripts/onboarding.py event $O javascript-react`; it prints `HTTP 200`. `$A wait --text "Error Received"`, then `$A find role button click --name "Take me to my error"` (it is a link button, so it has role `button`). The URL is `/organizations/$O/issues/<id>/?project=<id>&referrer=onboarding-first-event-footer`, and `state` shows a non-null `first_event`.
- **`member-new-org`: member.** With another fresh org `O2`, run the welcome step and the shared recipe with `$M`. Capture the HAR of the copy click: the `agent-handoff/prompts/` entry has status `201`. Setup docs open, and `state` shows one `Active` project.

## Gotchas

- Clicking `Add GitHub` opens github.com to install a GitHub App. Local dev has no GitHub App, so the install cannot finish here; `scm-connect-install` is proved by the acceptance test, which mocks the pipeline.
- Screenshots taken right after a step change catch a spinner. Wait for text from the new step before you capture.
- The member belongs to every seeded org and its team, as a plain team member, not a team admin. In proof2, projects that the member created went to a team created for them (`team-verify-member-<suffix>`), not to `onboarding`.
- Without taskbroker (`devservices up --mode taskbroker`), `event` returns 200 but the footer stays on `Waiting for error`.

## Gaps

- A browser drive of a real GitHub install (`scm-connect-install`) needs a GitHub App configured for the local devserver. Until one exists, the acceptance test is the only proof.
- The acceptance-test proofs of `scm-connect-install` and `scm-reload-restores-repo` need Chrome and a matching chromedriver. The sandbox that wrote this skill had neither, so they have not run here yet.
