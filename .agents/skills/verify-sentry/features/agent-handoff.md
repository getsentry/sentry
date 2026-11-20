# Agent handoff

A user copies a prompt for their coding agent. The agent claims the handoff code in the prompt, gets a private guide with OAuth setup and an onboarding run code, reports each stage as it sets up Sentry, and the page shows the progress live until it lands on the first issue. It starts from new-org welcome and from `/projects/new/`; completion in an existing org is in `project-creation.md`.

## Sub-features

- `prompt-copy` copies a prompt that points at `<host>/agent-handoff.md` and carries a `sntryh_` handoff code, and confirms with `Agent prompt copied to clipboard`.
- `handoff-claim` gives the agent a private guide for this org on the first claim of the code, and refuses a second claim or a made-up code.
- `progress-live` shows each stage the agent reports without a reload.
- `progress-survives-reload` shows the same run and its progress after a reload during the run.
- `failed-run-recovery` shows `Setup Didn’t Finish` with `Try again` and a manual path when the agent reports a failure.
- `complete-new-org` ends onboarding with `You're All Set`: a `Check out your first issue` card that opens the agent's issue, no `Skip setup`, and the stepper on its last step.
- `reload-after-complete` still shows `You're All Set` after a reload of a finished run, and does not start a new setup.

## How to get to it (user POV)

- New org: `/onboarding/<org>/welcome/`, agent card, `Copy agent prompt`.
- Existing org: `/organizations/<org>/projects/new/` (it redirects to `/organizations/<org>/insights/projects/new/`), agent card, `Copy agent prompt`.
- Agent side: paste the prompt into a coding agent. `fake_agent.py` plays that agent here.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`, flags include `agentic`. `O` is a fresh entry of `new_orgs`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/agent-handoff`.
- `FA="python3 .agents/skills/verify-sentry/scripts/fake_agent.py"`.

- **`prompt-copy`: copy.** `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, wait for the prompt as in `README.md`, start a HAR, `$A find role button click --name "Copy agent prompt"`, and stop the HAR to `$EV/copy.har`. `$A snapshot` contains `Agent prompt copied to clipboard`. In the HAR, the `POST /api/0/organizations/$O/agent-handoff/prompts/` entry is `201` and its response has a `code` starting with `sntryh_`. The paste check from `README.md` returns text that contains `http://dev.getsentry.net:8000/agent-handoff.md` and that `code`.
- **`handoff-claim`, `progress-live`, `complete-new-org`: run the agent.** Start it in the background so the page can be watched: `setsid nohup $FA --org $O --team onboarding --har $EV/copy.har --out $EV/agent-transcript.json --delay 6 > $EV/agent-stdout.json 2>&1 < /dev/null &`. Within 15 seconds the page shows heading `Agent Connected`, and `Done` rows appear one by one; save a screenshot. When `$EV/agent-stdout.json` is written it has `"guide_has_org_slug": true` and `"run_status": "completed"`. The page shows `You're All Set`; `snapshot -i` lists link `Check out your first issue` and no `Skip setup` button, and the stepper marks its last step current. Clicking the link opens `/organizations/$O/issues/<issue_ids[0]>/`.
- **`handoff-claim`: reuse the code.** `CODE=$(jq -r '.log.entries[]|select(.request.url|test("agent-handoff/prompts/"))|.response.content.text' $EV/copy.har | jq -r .code)`. Then `curl -s -o /dev/null -w "%{http_code}\n" -X POST -d "handoff_code=$CODE" http://dev.getsentry.net:8000/agent-handoff.md` prints `410`, and the same with `handoff_code=notarealcode` prints `400`.
- **`progress-survives-reload`: reload mid-run.** On a fresh org, copy and start the agent as above with `--delay 6`. After `Agent Connected` appears, `$A reload` and wait 6 seconds. The page still shows `Agent Connected` and the `Done` rows reported so far, and the run finishes on the same page.
- **`reload-after-complete`: reload a finished run.** On `You're All Set`, `$A reload` and wait 7 seconds. The page still shows `You're All Set`, not the welcome agent card.
- **`failed-run-recovery`: failure.** On `/organizations/<existing_org>/projects/new/`, copy with a HAR to `$EV/fail-copy.har`, then `$FA --org <existing_org> --team backend --project-name agent-fail --har $EV/fail-copy.har --fail-at instrument_app --out $EV/fail-transcript.json`. It prints `"run_status": "failed"`. The page shows heading `Setup Didn’t Finish`, text `Your agent ran into a problem. Try again or set up manually.`, and buttons `Try again` and `Prefer to do it yourself? Set up manually`.

## Gotchas

- The prompt button is disabled until the page has created or resumed its onboarding run. Clicking it early is a silent no-op, and the HAR has no code.
- The clipboard text is worded differently from the `prompt` field of the API response. Compare the URL and code, not the whole string.
- Only the first copy after a page load mints a code. Start the HAR before that click, or reload the page before you copy again.
- `fake_agent.py` follows the guide's API contract but does not judge its prose. Whether a real coding agent (Claude Code, Cursor, Codex) follows the guide needs that agent pointed at the local devserver with network access to docs.sentry.io; it is not reachable with this harness.
- A second browser session for the same org starts a different run. Drive one run from one session.
- HAR files and transcripts hold live handoff codes and tokens for the local instance. Keep them in the evidence dir only.
