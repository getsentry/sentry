# Sentry verification map

This directory is the maintained source for verifying the user-facing behavior of the Sentry web app. Each file covers one system; the first systems mapped are onboarding and project creation. Read this index before you drive. Then use the matching feature file as the recipe.

## Baseline preconditions

- `sentry_dev.py launch` with the default flags (`agentic,scm-project-creation`) unless a recipe says otherwise, then `seed`, `login owner`, and `login member`. `doctor` reports `ok` on every line.
- Base URL `http://dev.getsentry.net:8000`. Read org slugs from `/tmp/verify-sentry/seed.json`: `new_orgs[i]`, `existing_org`, `new_team` (`onboarding`), `existing_team` (`backend`).
- Use a fresh org from `new_orgs` for every new-org journey. Onboarding has no reset: a second journey in the same org starts with that org's leftovers.
- Never drive an instance that this run did not start.

## Driving conventions

- `A="agent-browser --session verify-sentry-owner"` and `M="agent-browser --session verify-sentry-member"`. `ST=".venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py state"`. `EV` is the absolute evidence dir for the feature.
- Prefer accessible names and data attributes over CSS selectors or DOM position.
- Wait for the agent prompt to be ready before copying it. The button renders disabled until the page has its onboarding run: `$A wait --fn "(b => b && !b.disabled)(document.querySelector('button[aria-label=\"Copy agent prompt\"]'))"`.
- Start HAR capture before the first `Copy agent prompt` click after a page load: `$A network har start`, click, `sleep 2`, `$A network har stop $EV/copy.har`. The page reuses the code it minted for 5 minutes, so a second click sends no request and the HAR has no code.
- The platform picker is a combobox: `$A fill 'input[aria-autocomplete="list"]' "React"`, then `$A click 'xpath=//p[@data-test-id="menu-list-item-label"][text()="React"]'`.
- Read the clipboard by pasting it, as a user would: `navigator.clipboard.readText()` is denied even on the allowed origin. Run `$A eval "(()=>{const t=document.createElement('textarea');t.id='verify-paste';document.body.appendChild(t);t.focus()})()"`, `$A press Control+v`, read `$A eval "document.getElementById('verify-paste').value"`, then `$A eval "document.getElementById('verify-paste').remove()"`. Call this the paste check.
- Treat every command as literal. Keep quoted names and flags unchanged.

### Shared recipe: new org to setup docs (manual)

Run against a fresh org `O`:

1. `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, then `$A wait '[data-test-id="onboarding-setup-in-browser"]'` and `$A click '[data-test-id="onboarding-setup-in-browser"]'` ("Prefer to do it yourself? Set up manually").
2. `$A wait '[data-test-id="onboarding-step-scm-connect"]'`, then `$A find role button click --name "Continue without a repo"`.
3. `$A wait '[data-test-id="onboarding-step-scm-platform-features"]'`, pick React with the platform combobox, and `$A wait --text "What do you want to track?"`. `Continue` stays disabled until the products appear. Then `$A find role button click --name "Continue" --exact`.
4. `$A wait --text "Configure React SDK"`. The URL is `/onboarding/$O/setup-docs/?product=error-monitoring&product=performance-monitoring`, because the platform step preselects Tracing for React.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen: a screenshot and `snapshot -i` after the result appears.
- A page that looks right is not proof that the project and DSN exist. Save `state` JSON before and after any step that can create or delete a project.
- Record the sub-feature ID and the entry point used with every artifact.
- Report each sub-feature as pass or fail with its artifacts. When the product does not do what a sub-feature says, report it as a product gap. Do not edit the sub-feature to match the product.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with agent-browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run, including any prerequisite that a run cannot meet locally.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [New org onboarding](./new-org-onboarding.md) covers `/onboarding/:org/` from welcome to the first event, SCM connect, and a member in a new org.
- [Manual setup docs](./manual-setup-docs.md) covers the "Configure React SDK" page: DSN, Copy DSN, product toggles, waiting for the first event, and Skip setup.
- [Agent handoff](./agent-handoff.md) covers the coding-agent prompt, the handoff code, live progress, failure, completion, and reloads, from onboarding and from `/projects/new/`.
- [Navigation and state](./navigation-state.md) covers in-app back, browser back and forward, changing the platform, reload, and deep links mid-flow, and whether the project and DSN survive each one.
- [Project creation](./project-creation.md) covers `/projects/new/` in an existing org, manual and agent, where completion lands, and member permissions.
