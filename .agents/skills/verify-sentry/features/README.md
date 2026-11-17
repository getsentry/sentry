# Sentry verification map

This directory is the maintained source for verifying the Sentry web app. Each file covers one system; the first systems mapped are onboarding and project creation. Read this index before you drive. Then use the matching feature file as the recipe.

## Baseline preconditions

- `sentry_dev.py launch` with the default flags (`agentic,scm-project-creation`) unless a recipe says otherwise, then `seed`, `login owner`, and `login member`. `doctor` reports `ok` on every line.
- Base URL `http://dev.getsentry.net:8000`. Read org slugs from `/tmp/verify-sentry/seed.json`: `new_orgs[i]`, `existing_org`, `new_team` (`onboarding`), `existing_team` (`backend`).
- Use a fresh org from `new_orgs` for every new-org journey. Onboarding has no reset: a second journey in the same org starts with that org's leftovers.
- Never drive an instance that this run did not start.

## Driving conventions

- `A="agent-browser --session verify-sentry-owner"` and `M="agent-browser --session verify-sentry-member"`. `ST=".venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py state"`. `EV` is the absolute evidence dir for the feature.
- Wait for the agent prompt to be ready before copying it. The button renders disabled until the onboarding run exists: `$A wait --fn "(b => b && !b.disabled)(document.querySelector('button[aria-label=\"Copy agent prompt\"]'))"`.
- Start HAR capture before the first `Copy agent prompt` click after a page load: `$A network har start`, click, `sleep 2`, `$A network har stop $EV/copy.har`. The page caches the minted handoff code for 5 minutes, so a second click sends no request and the HAR has no code.
- The platform picker is a combobox: `$A fill 'input[aria-autocomplete="list"]' "React"`, then `$A click 'xpath=//p[@data-test-id="menu-list-item-label"][text()="React"]'`.
- Read the clipboard by pasting it, as a user would: `navigator.clipboard.readText()` is denied even on the allowed origin. Run `$A eval "(()=>{const t=document.createElement('textarea');t.id='verify-paste';document.body.appendChild(t);t.focus()})()"`, `$A press Control+v`, read `$A eval "document.getElementById('verify-paste').value"`, then `$A eval "document.getElementById('verify-paste').remove()"`. Call this the paste check.
- Treat every command as literal.

### Shared recipe: new org to setup docs (manual)

Run against a fresh org `O`:

1. `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, then `$A wait '[data-test-id="onboarding-setup-in-browser"]'` and `$A click '[data-test-id="onboarding-setup-in-browser"]'` ("Prefer to do it yourself? Set up manually").
2. `$A wait '[data-test-id="onboarding-step-scm-connect"]'`, then `$A find role button click --name "Continue without a repo"`.
3. Pick React with the platform combobox, then `$A find role button click --name "Continue" --exact`.
4. `$A wait --text "Configure React SDK"`. The URL is `/onboarding/$O/setup-docs/?product=error-monitoring`.

## Proof and skip reporting

- Capture the user action and the resulting state: a screenshot and `snapshot -i` after the result appears, and `state` JSON before and after any step that can create or delete a project.
- Record the claim ID (`<file>#<id>`) and the entry point with every artifact.
- Report a claim as `pass` or `fail` with its artifacts. A failing claim stays as written; add or update its `Fails today` note.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Claim IDs

- A claim ID is lowercase kebab-case and unique in its file. Cite it as `<file>#<id>`, where `<file>` is the file name without `.md`. Example: `navigation-state#inapp-back-keeps-project`.
- Tests and PRs cite claims by this ID. Put it in the test name or a comment, so `rg 'navigation-state#inapp-back-keeps-project'` finds the map entry and its proof.
- Do not rename or reuse an ID. When a behavior changes meaning, retire its ID and add a new one. Search the repo for citations before you retire one.

## Map entry contract

Each feature file starts with an H1 title and one paragraph that describes the behavior. Then it has exactly five H2 sections, in this order.

1. `Claims` lists one bullet per claim: the ID, one line of intended behavior, and its proof (`drive`, or `test` with the exact command). A claim the product fails today ends with `Fails today (<run>): <what was observed>`.
2. `How to get to it` lists every user entry point.
3. `Driving it with agent-browser` starts with `Preconditions:`. Then each bullet starts with the claim IDs it proves, and pairs an action with an exact command and an observable result.
4. `Gotchas` lists traps that can waste or invalidate a run.
5. `Gaps` lists each claim with no runnable proof here, and what blocks it. `None.` when there are none.

## Feature files

- `new-org-onboarding.md`: the `/onboarding/:org/` steps from welcome to the first event, SCM connect, and a member in a new org.
- `manual-setup-docs.md`: the "Configure React SDK" page: DSN, Copy DSN, product toggles, wait for the first event, and the Skip setup escape hatch.
- `agent-handoff.md`: the coding-agent prompt, handoff code claim, live progress, failure, completion, and refresh during and after a run, in both onboarding and `/projects/new/`.
- `navigation-state.md`: in-app back, browser back and forward, changing the platform, refresh, and deep links mid-flow, and whether the project and DSN survive each one.
- `project-creation.md`: `/projects/new/` in an existing org, manual and agent, its getting-started page, where completion lands, and member permissions.

## Regression suites

These suites cover the same code with mocks. They are not claim proofs, but run them after a fix:

- `pnpm test-ci static/app/views/onboarding/ static/app/components/agentHandoff/ static/app/views/projectInstall/`
- `.venv/bin/pytest tests/sentry/agent_handoff/ tests/sentry/api/endpoints/test_organization_agentic_onboarding.py`
- `.venv/bin/pytest tests/acceptance/test_onboarding.py tests/acceptance/test_create_project.py` (needs Chrome and a matching chromedriver). Several of these assert today's delete-on-back behavior; see `navigation-state.md` Gotchas.
