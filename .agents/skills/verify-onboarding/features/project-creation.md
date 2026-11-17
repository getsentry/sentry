# Project creation in an existing org

A user in an org that already has projects adds one from `/projects/new/`: hand it to a coding agent, or fill the create form and follow the getting-started page. Completion must lead to the new project, and going back must not lose it.

## Claims

- `entry-choices` shows `Create a Project` with the agent card (`Copy agent prompt`) and `Prefer to do it yourself? Set up manually`. Proof: `drive`.
- `agent-creates-project` shows `Your Projects Are Ready` with a `Check out your first issue` card when the agent completes a `create_project` run, and the agent's project appears in the org. Proof: `drive`.
- `agent-complete-lands-on-project` makes the primary action on `Your Projects Are Ready` open the new project or its first issue. Proof: `drive`. Fails today (proof2): the primary action is `View projects`, which opens the generic `/organizations/<org>/insights/projects/` list.
- `manual-creates-project` creates one active project from the form (platform React, the default name `javascript-react`) and opens its getting-started page, `Configure React SDK`, with that project's DSN. Proof: `drive`.
- `getting-started-first-event` shows on the getting-started page whether the first error has arrived, as the onboarding setup docs do. Proof: `drive`. Fails today (proof2): the page has no waiting or received indicator, only `Take me to Issues`.
- `back-to-platform-keeps-project` keeps the new project and its DSN when the user chooses `Back to Platform Selection`. Proof: `drive`. Fails today (proof2): the project goes to `Pending Deletion`.
- `member-creates-project` lets a member create a project from the form and reach its getting-started page. Proof: `drive`.
- `member-disallowed-explained` tells a member who may not create projects why, before they copy an agent prompt or submit the form, when the org turns off member project creation. Proof: `drive`. Fails today (proof2): the page looks the same as for an owner; see Gotchas for what each path then did.

## How to get to it

- `/organizations/<org>/projects/new/`, which redirects to `/organizations/<org>/insights/projects/new/`.
- The `Create Project` buttons on the projects list and in the project picker.
- Getting started: `/organizations/<org>/insights/projects/<slug>/getting-started/`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`, flags include `agentic` and `scm-project-creation`. `O` is `existing_org`, which starts with only `api-server`.
- `EV=$PWD/.artifacts/verify-onboarding/<run-id>/project-creation`. Run `$A eval "sessionStorage.clear()"` on the page first, so no earlier run is resumed.

- **`entry-choices`: entry.** `$A open "http://dev.getsentry.net:8000/organizations/$O/projects/new/"` and wait for the prompt as in `README.md`. Heading `Create a Project`, heading `Let your agent set up Sentry`, and buttons `Copy agent prompt` and `Prefer to do it yourself? Set up manually` are present.
- **`agent-creates-project`, `agent-complete-lands-on-project`: agent.** Copy with a HAR to `$EV/copy.har`; its request body has `"flow":"create_project"`. Run `python3 .agents/skills/verify-onboarding/scripts/fake_agent.py --org $O --team backend --project-name agent-web --har $EV/copy.har --out $EV/agent-transcript.json`; it prints `"run_status": "completed"`. The page shows heading `Your Projects Are Ready` and link `Check out your first issue`, and `$ST $O` lists `agent-web` as `Active`. The primary button must open `/organizations/$O/issues/…` or the `agent-web` project, not `/organizations/$O/insights/projects/`. Click it and record `$A get url`.
- **`manual-creates-project`: form.** Reload, clear `sessionStorage`, `$A find role button click --name "Prefer to do it yourself? Set up manually"`. Heading `Create a project` shows `Repository`, `Platform`, and `Products`. Pick React with the platform combobox; `Project name` fills with `javascript-react`. `$A find role button click --name "Create project"`, then `$A wait --text "Configure React SDK"`. The URL is `/organizations/$O/insights/projects/javascript-react/getting-started/?product=error-monitoring&projectCreationVariant=scm`, and `$ST $O --out $EV/manual-create.json` lists `javascript-react` as `Active` with the DSN that the snippet shows.
- **`getting-started-first-event`: first error.** Run `.venv/bin/python .agents/skills/verify-onboarding/scripts/onboarding.py event $O javascript-react`. Without a reload, the page must show that the error arrived (`Error Received` or an equivalent status). Check with `$A eval "/Waiting for|Error Received/.test(document.body.innerText)"` before and after the event.
- **`back-to-platform-keeps-project`: back.** On a getting-started page from `manual-creates-project`, `$A find role button click --name "Back to Platform Selection"` and `sleep 4`. The URL is `/organizations/$O/insights/projects/new/?referrer=getting-started&project=<id>`. `$ST $O --out $EV/back-to-platform.json` must still list the project `Active` with its DSN.
- **`member-creates-project`: member.** Repeat `manual-creates-project` with `$M`. The getting-started page opens, and `state` lists the new project `Active`.
- **`member-disallowed-explained`: creation off for members.** Turn member project creation off as the owner: `$A open "http://dev.getsentry.net:8000/settings/$O/"`, `$A find role checkbox click --name "Let Members Create Projects"`, and wait for the save toast. Then `$M open "http://dev.getsentry.net:8000/organizations/$O/projects/new/"`. Before any click, the page must tell the member that they cannot create projects here, or route them to a request flow. Record what it shows. Then copy the prompt with a HAR and run `fake_agent.py` as above with `--team backend --project-name member-agent`; record its exit and the page state. Turn the setting back on afterward.

## Gotchas

- `View projects` and `Back to Platform Selection` are buttons, not links, in the accessibility tree.
- The legacy create-project page (flags without `scm-project-creation`) has different handles: `[data-test-id='platform-javascript-react']` and `[data-test-id="create-project"]`. `tests/acceptance/test_create_project.py` drives that page.
- `getting-started-first-event` is a parity claim with the onboarding setup docs. If the team decides that this page should not wait for events, retire the claim rather than weakening it.
- In proof2, with member project creation off, the page showed no notice to the member. The agent's `POST /api/0/teams/$O/backend/projects/` got `403` (`Your organization has disabled this feature for members.`), and the page stayed on `Your Agent Is Setting Up Sentry`, because `fake_agent.py` exits on that error without reporting a failure. The manual form still succeeded by creating the project on a team created for the member (`team-verify-member-<suffix>`). Whether that is intended is a product decision; record what you see.
- Projects from earlier journeys stay in `existing_org`. Compare project IDs from `state`, not counts, when several journeys share the org.

## Gaps

None.
