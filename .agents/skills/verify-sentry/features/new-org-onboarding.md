# New org onboarding

A user in an org with no projects goes through `/onboarding/<org>/`: welcome, connect a repo or skip it, pick a platform and products, land on the setup docs with a working project and DSN, and finish when the first error arrives. The agent path that starts on the same welcome page is in `agent-handoff.md`.

## Sub-features

- `welcome-choices` offers both ways to start: the agent card with `Copy agent prompt`, and `Prefer to do it yourself? Set up manually`.
- `scm-connect-providers` lists GitHub, GitLab, and Bitbucket on the connect step, with `Continue without a repo` to go on without one.
- `scm-connect-repo` connects a GitHub repo from the connect step, uses it to suggest the platform, and keeps it selected after a reload.
- `platform-creates-project` creates exactly one active project with a DSN for the chosen platform and opens its setup docs.
- `first-event-lands-on-issue` turns `Waiting for error` into `Error Received` when the first error arrives, and `Take me to my error` opens that issue.
- `member-new-org` lets a member of a new org copy an agent prompt and create the first project on the manual path.

## How to get to it (user POV)

- Create an org, which redirects to `/onboarding/<org>/welcome/`.
- Open `/onboarding/<org>/` directly; it redirects to `welcome/`.
- Steps by URL: `welcome/`, `scm-connect/`, `scm-platform-features/`, `scm-messaging/` (only with `--flags …,messaging`), `setup-docs/`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. `O` is an unused entry of `new_orgs`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/new-org-onboarding`.

- **`welcome-choices`: welcome.** `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, then wait for the prompt as in `README.md`. `$A snapshot -i > $EV/welcome-choices.aria.txt` lists heading `Let your agent set up Sentry`, button `Copy agent prompt` (enabled), and button `Prefer to do it yourself? Set up manually`.
- **`scm-connect-providers`: connect step.** `$A click '[data-test-id="onboarding-setup-in-browser"]'`, then `$A wait 'button[aria-label="Add GitHub"]'` (the providers load after the rest of the step). `$A snapshot -i > $EV/scm-connect-providers.aria.txt` lists buttons `Add GitHub`, `Add GitLab`, `Add Bitbucket`, `More providers`, `Back`, `Continue without a repo`, and a disabled `Continue`.
- **`scm-connect-repo`: connect GitHub.** `$A find role button click --name "Add GitHub"`, finish the install, pick a repo, and choose `Continue`. The platform step suggests the repo's platform. Go back to the connect step and `$A reload`: the same repo is still selected.
- **`platform-creates-project`: pick React.** Finish the shared recipe in `README.md`. The URL is on `/setup-docs/`. `$ST $O --out $EV/platform-creates-project.json` shows one project, `javascript-react`, status `Active`, `first_event: null`, with one DSN.
- **`first-event-lands-on-issue`: first error.** `snapshot` contains `Waiting for error`. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py event $O javascript-react`; it prints `HTTP 200`. `$A wait --text "Error Received"`, then `$A find role button click --name "Take me to my error"`. The URL is `/organizations/$O/issues/<issue-id>/…`, the issue of that error, and `$ST $O --out $EV/first-event-lands-on-issue.json` shows a non-null `first_event`.
- **`member-new-org`: member.** With another fresh org `O2`, run the welcome step and the shared recipe with `$M`. Capture the HAR of the copy click: the `agent-handoff/prompts/` entry has status `201`. Setup docs open, and `state` shows one `Active` project.

## Gotchas

- `scm-connect-repo` needs a GitHub App configured for the local devserver. `Add GitHub` opens github.com, and without that app the install cannot finish. Report it unreachable with that prerequisite.
- Screenshots taken right after a step change catch a spinner. Wait for text from the new step before you capture.
- `Take me to my error` is a link styled as a button, so its role is `button`.
- The member belongs to every seeded org and its team as a plain team member, not a team admin. Projects that the member creates can land on a team made for them (`team-verify-member-<suffix>`), not on `onboarding`.
- Without taskbroker (`devservices up --mode taskbroker`), `event` returns 200 but the footer stays on `Waiting for error`.
