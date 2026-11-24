# Agent handoff

A user copies a prompt for their coding agent. The agent claims the handoff code in the prompt, gets a private guide with OAuth setup and an onboarding run code, reports each stage as it sets up Sentry, and the page shows the progress live until it lands on the first issue. It starts from new-org welcome (`flow: onboarding`) and from `/projects/new/` (`flow: create_project`); completion in an existing org is in `project-creation.md`.

## Claims

- `prompt-copy` copies a prompt that points at `<host>/agent-handoff.md` and carries a `sntryh_` handoff code, and shows `Agent prompt copied to clipboard`. Proof: `drive`.
- `claim-guide` returns the private guide when the agent posts the code to `/agent-handoff.md`: it names the org slug and gives a client ID, a setup code that redeems at `/oauth/token/`, and an onboarding run code. Proof: `drive`.
- `claim-single-use` refuses a second claim of the same code with `410`, and a made-up code with `400`. Proof: `drive`.
- `claim-expired` refuses a code after it expires. Proof: `test` with `.venv/bin/pytest tests/sentry/agent_handoff/test_views.py::AgentHandoffViewTest::test_expired_handoff_is_unavailable`.
- `progress-live` shows each stage the agent reports (`Agent Connected`, `Created 1 project`, `Done` rows) without a reload. Proof: `drive`.
- `progress-survives-reload` shows the same run, with its progress, after a reload during the run. Proof: `drive`.
- `failed-run-recovery` shows `Setup Didn’t Finish` with `Try again` and `Prefer to do it yourself? Set up manually` when the agent reports a failure. Proof: `drive`.
- `complete-new-org` shows `You're All Set` with a `Check out your first issue` card that opens the agent's verification issue when the run completes in a new org. Proof: `drive`.
- `complete-final-state` shows completion as the end of onboarding: no `Skip setup` button, and the stepper on its last step. Proof: `drive`. Fails today (proof2): `Skip setup` is still shown on `You're All Set`, and the stepper stays on step 1.
- `reload-after-complete` still shows `You're All Set` after a reload of a completed run, and starts no new run. Proof: `drive`. Fails today (proof2): the reload creates a new run (`POST …/onboarding/agent/runs/` returns a new run ID) and the page shows the welcome agent card again, inviting a second setup.

## How to get to it

- New org: `/onboarding/<org>/welcome/`, agent card, `Copy agent prompt`.
- Existing org: `/organizations/<org>/projects/new/` (it redirects to `/organizations/<org>/insights/projects/new/`), agent card, `Copy agent prompt`.
- Agent side: `POST /agent-handoff.md` with form field `handoff_code`, then `POST /oauth/token/` with grant type `urn:sentry:params:oauth:grant-type:setup_code`, then `POST /api/0/organizations/<org>/onboarding/agent/status/`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`, flags include `agentic`. `O` is a fresh entry of `new_orgs`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/agent-handoff`.
- `FA="python3 .agents/skills/verify-sentry/scripts/fake_agent.py"`.

- **`prompt-copy`: copy.** `$A open "http://dev.getsentry.net:8000/onboarding/$O/"`, wait for the prompt as in `README.md`, start a HAR, `$A find role button click --name "Copy agent prompt"`, and stop the HAR to `$EV/copy.har`. `$A snapshot` contains `Agent prompt copied to clipboard`. In the HAR, the `POST /api/0/organizations/$O/agent-handoff/prompts/` entry is `201`, its request body has `"flow":"onboarding"`, and its response has a `code` starting with `sntryh_`. The paste check from `README.md` returns text that contains `http://dev.getsentry.net:8000/agent-handoff.md` and that `code`.
- **`claim-guide`, `progress-live`, `complete-new-org`: run the agent.** Start it in the background so the page can be watched: `setsid nohup $FA --org $O --team onboarding --har $EV/copy.har --out $EV/agent-transcript.json --delay 6 > $EV/agent-stdout.json 2>&1 < /dev/null &`. Within 15 seconds the page shows heading `Agent Connected` and `Done` rows appear one by one; save a screenshot. When `$EV/agent-stdout.json` is written it has `"guide_has_org_slug": true` and `"run_status": "completed"`. The page shows `You're All Set` and a link `Check out your first issue`; clicking it opens `/organizations/$O/issues/<issue_ids[0]>/`.
- **`claim-single-use`: reuse the code.** `CODE=$(jq -r '.log.entries[]|select(.request.url|test("agent-handoff/prompts/"))|.response.content.text' $EV/copy.har | jq -r .code)`, then `curl -s -o /dev/null -w "%{http_code}\n" -X POST -d "handoff_code=$CODE" http://dev.getsentry.net:8000/agent-handoff.md` prints `410`, and the same with `handoff_code=notarealcode` prints `400`.
- **`progress-survives-reload`: reload mid-run.** On a fresh org, start the agent as above with `--delay 6`. After `Agent Connected` appears, `$A reload` and wait 6 seconds. The page still shows `Agent Connected` and the `Done` rows reported so far, and the run finishes on the same page.
- **`reload-after-complete`: reload a finished run.** After `You're All Set`, `$A reload` and wait 7 seconds. The page must still show `You're All Set`, and `$A network requests --filter onboarding/agent` must show no new run ID.
- **`complete-final-state`: end state.** On `You're All Set`, `snapshot -i` must list no `Skip setup` button, and the stepper must mark its last step current.
- **`failed-run-recovery`: failure.** On `/projects/new/` of `existing_org`, copy with a HAR, then `$FA --org <existing_org> --team backend --project-name agent-fail --har $EV/fail-copy.har --fail-at instrument_app --out $EV/fail-transcript.json`. It prints `"run_status": "failed"`. The page shows heading `Setup Didn’t Finish`, text `Your agent ran into a problem. Try again or set up manually.`, and buttons `Try again` and `Prefer to do it yourself? Set up manually`.

## Gotchas

- The prompt button is disabled until the page has created or resumed its onboarding run. Clicking it early is a silent no-op, and the HAR has no code.
- The clipboard text (``Read and follow <host>/agent-handoff.md verbatim. Your handoff code is `…`.``) is worded differently from the `prompt` field of the API response (`Follow the instructions verbatim at …`). Compare the URL and code, not the whole string.
- Only the first copy after a page load mints a code. Start the HAR before that click, or reload the page before you copy again.
- `fake_agent.py` stands in for a real coding agent. It follows the guide's API contract, but it does not judge the guide's prose. Whether a real agent follows the guide is an eval question; see Gaps.
- The onboarding run is keyed by the `agenticProgressClientRunId` field of the `onboarding` entry in `sessionStorage`. A second browser session for the same org starts a different run.
- HAR files and transcripts hold live handoff codes and tokens for the local instance. Keep them in the evidence dir only.

## Gaps

- A real coding agent (Claude Code, Cursor, Codex) following the guide end to end has no runnable proof here. It needs network access to docs.sentry.io and an agent eval harness that points the agent at the local devserver.
