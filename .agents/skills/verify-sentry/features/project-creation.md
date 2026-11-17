# Project creation in an existing org

A user in an org that already has projects adds one from `/projects/new/`: hand it to a coding agent, or fill the create form and follow the getting-started page. Completion leads to the new project, and going back does not lose it.

## Sub-features

- `entry-choices` shows `Create a Project` with the agent card (`Copy agent prompt`) and `Prefer to do it yourself? Set up manually`.
- `agent-creates-project` shows `Your Projects Are Ready` when the agent finishes, the agent's project appears in the org, and the primary action opens that project or its first issue.
- `manual-creates-project` creates one active project from the form and opens its getting-started page, `Configure React SDK`, with that project's DSN.
- `first-event-on-issues` hands off from the getting-started page with `Take me to Issues`. Issues opens on the new project's setup steps, waits for its first error on the last step, and links to that error when it arrives, without a reload.
- `back-to-platform-keeps-project` keeps the new project and its DSN when the user chooses `Back to Platform Selection`.
- `member-creates-project` lets a member create a project from the form and reach its getting-started page.
- `member-disallowed-explained` tells a member who may not create projects why, before they copy an agent prompt or submit the form.

## How to get to it (user POV)

- `/organizations/<org>/projects/new/`, which redirects to `/organizations/<org>/insights/projects/new/`.
- The `Create Project` buttons on the projects list and in the project picker.
- Getting started: `/organizations/<org>/insights/projects/<slug>/getting-started/`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`, flags include `agentic` and `scm-project-creation`. `O` is `existing_org`, which starts with only `api-server`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/project-creation`. Run `$A eval "sessionStorage.clear()"` on the page first, so no earlier run is resumed.

- **`entry-choices`: entry.** `$A open "http://dev.getsentry.net:8000/organizations/$O/projects/new/"` and wait for the prompt as in `README.md`. Heading `Create a Project`, heading `Let your agent set up Sentry`, and buttons `Copy agent prompt` and `Prefer to do it yourself? Set up manually` are present.
- **`agent-creates-project`: agent.** Copy with a HAR to `$EV/copy.har`. Run `python3 .agents/skills/verify-sentry/scripts/fake_agent.py --org $O --team backend --project-name agent-web --har $EV/copy.har --out $EV/agent-transcript.json`; it prints `"run_status": "completed"`. The page shows heading `Your Projects Are Ready` and link `Check out your first issue`, and `$ST $O --out $EV/agent-creates-project.json` lists `agent-web` as `Active`. Click the primary button and record `$A get url`: it is `/organizations/$O/issues/…` or the `agent-web` project.
- **`manual-creates-project`: form.** Reload, clear `sessionStorage`, `$A find role button click --name "Prefer to do it yourself? Set up manually"`. Heading `Create a project` shows `Repository`, `Platform`, and `Products`. Pick React with the platform combobox; `Project name` fills with `javascript-react`. `$A find role button click --name "Create project"`, then `$A wait --text "Configure React SDK"`. The URL is `/organizations/$O/insights/projects/javascript-react/getting-started/…`, and `$ST $O --out $EV/manual-creates-project.json` lists `javascript-react` as `Active` with the DSN that the snippet shows.
- **`first-event-on-issues`: first error.** On the getting-started page from `manual-creates-project`, `$A find role button click --name "Take me to Issues"` and `$A wait --text "Get Started with Sentry Issues"`. The URL is `/organizations/$O/issues/?guidedStep=1&project=<id>`. Click the step's `Next` twice with `$A click 'xpath=//button[normalize-space()="Next"]'`: the URL reaches `guidedStep=3` and the page shows `Waiting for this project's first error`. Save a screenshot. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py event $O javascript-react`, then `$A wait --text "Take me to my error"` without a reload. `$A click 'xpath=//a[normalize-space()="Take me to my error"]'` opens `/organizations/$O/issues/<issue-id>/…`.
- **`back-to-platform-keeps-project`: back.** On the getting-started page from `manual-creates-project`, `$A find role button click --name "Back to Platform Selection"` and `sleep 4`. The URL is `/organizations/$O/insights/projects/new/?referrer=getting-started&project=<id>`. `$ST $O --out $EV/back-to-platform.json` still lists the project `Active` with its DSN.
- **`member-creates-project`: member.** Repeat `manual-creates-project` with `$M` and another platform. The getting-started page opens, and `state` lists the new project `Active`.
- **`member-disallowed-explained`: creation off for members.** As the owner, `$A open "http://dev.getsentry.net:8000/settings/$O/"`, `$A find role checkbox click --name "Let Members Create Projects"`, and wait for the save toast. Then `$M open "http://dev.getsentry.net:8000/organizations/$O/projects/new/"`. Before any click, `$M snapshot -i > $EV/member-disallowed.aria.txt` shows that the member cannot create projects here. Turn the setting back on afterward.

## Gotchas

- The getting-started page itself shows no first-event status; waiting for the first error happens on Issues. The wait shows only on the last setup step (`Verify`), and only for platforms with the guided Issues setup, which includes React.
- `find role button click --name "Next"` on Issues can hit the disabled pagination button. Click the step's `Next` by its text.
- `View projects` and `Back to Platform Selection` are buttons, not links, in the accessibility tree.
- Without the `scm-project-creation` flag the page is the older create-project form, with different handles (`[data-test-id='platform-javascript-react']`, `[data-test-id="create-project"]`). These recipes need the flag.
- With member project creation off, `fake_agent.py` exits on the `403` from project creation without reporting a failure, so the page stays on `Your Agent Is Setting Up Sentry`. That is the stand-in agent stopping, not the product.
- Projects from earlier journeys stay in `existing_org`. Compare project IDs from `state`, not counts, when several journeys share the org.
