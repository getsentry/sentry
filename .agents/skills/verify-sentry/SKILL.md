---
name: verify-sentry
description: >-
  Verify the Sentry web app (getsentry/sentry) as a real user, against a disposable local devserver driven with agent-browser, with stored state checked through the API. One skill for the whole app; `features/` holds one file per system. Mapped today: new-org onboarding, project creation in an existing org, the coding-agent handoff, the manual "Configure <Platform> SDK" setup docs, and onboarding navigation state, for owner and member. Use when asked to verify, battle-test, or re-prove Sentry product behavior in a browser, or when a change touches a mapped system, such as `static/app/views/onboarding/`, `static/app/views/projectInstall/`, `static/app/components/agentHandoff/`, or `src/sentry/agent_handoff/`.
---

# Verify Sentry

Drive Sentry in a real browser against a devserver that this run starts, then check the stored result (orgs, projects, DSNs, events, agent runs) through the API. This is the one verification skill for the app: add a system by adding a feature file to `features/`, not a new skill. Never point this skill at sentry.io or at a devserver you did not start.

Run every command from the sentry checkout root. The helpers are `scripts/sentry_dev.py` (run it with `.venv/bin/python`) and `scripts/fake_agent.py` (stdlib only, any `python3`). Browser steps use the `agent-browser` CLI.

## Launch

Preconditions, once per machine: `devenv sync` has run, and `devservices up --mode taskbroker` is up. The default `devservices up` mode has no taskbroker, so event ingest and the first-event UI never complete.

```bash
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py launch --run-id <run-id>
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py seed
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py login owner
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py login member
```

`launch` writes a `SENTRY_CONF` overlay to `/tmp/verify-sentry/conf` on top of `~/.sentry`, then starts `sentry devserver --no-reload --no-prefix --workers --ingest --dev-consumer 127.0.0.1:8000` in its own process group. It is ready when the devserver log shows the rsbuild `built in … (app)` line and `/auth/login/` returns 200; the command blocks until then (up to 7 minutes on a cold build) and prints `run.json`.

Feature flags. Sentry-only dev has no flag handler, so `SENTRY_FEATURES` in the overlay decides every flag. `--flags` takes a comma list of the profiles below. They are the flags that the mapped systems need today; add a profile when a new feature file needs another flag:

| `--flags` name         | Flag                                                                                                                            | Default |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `agentic`              | `organizations:onboarding-agentic-setup` (agent card on welcome and on `/projects/new/`)                                        | on      |
| `scm-project-creation` | `organizations:onboarding-scm-project-creation` (SCM create-project form)                                                       | on      |
| `messaging`            | `organizations:onboarding-scm-messaging-experiment` (adds the `scm-messaging` step)                                             | off     |
| `scm`                  | `organizations:onboarding-scm` (registered and API-exposed; no frontend code reads it today, and the SCM steps show without it) | off     |

The overlay always turns on `organizations:session-replay`, `organizations:ourlogs-enabled`, and `organizations:tracemetrics-enabled`, because SaaS plans grant them and the product toggles render disabled without them. It also sets the agent handoff options `onboarding.agent-handoff.client-id` and `oauth.setup-code.allowed-client-ids` to `verify-sentry-agent-cli`. `seed` creates that public OAuth application. To change flags, run `stop`, then `launch` again.

`seed` creates the following. Passwords are derived from the instance's `SECRET_KEY` and are never written to disk or printed; `login` derives them again.

- An owner user and a member user (`verify-owner-<suffix>@example.com`, `verify-member-<suffix>@example.com`).
- `--new-orgs N` fresh orgs (`verify-new-<suffix>-1..N`, default 6) with team `onboarding` and no projects. Use one fresh org per journey: onboarding state cannot be reset in place.
- One existing org `verify-existing-<suffix>` with team `backend` and project `api-server`.

It writes `/tmp/verify-sentry/seed.json`. A second `seed` makes a new batch with new users, so run `login` again after it.

`login <role>` signs an agent-browser session named `verify-sentry-<role>` in as that user. Pass `--session <name>` for a second, independent browser (a fresh tab with no `sessionStorage`). Sessions launch Chromium with `--unsafely-treat-insecure-origin-as-secure=http://dev.getsentry.net:8000`, so clipboard writes work over plain HTTP.

## Doctor

```bash
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py doctor
```

Read-only. Every line must say `ok`: the devserver process from `run.json` is alive, port 8000 belongs to it or one of its children, the git revision matches the one at launch, `/api/client-config/` answers, and `/agent-handoff.md` answers. Run it first and again whenever a page looks wrong. On any `BAD`, run `stop` and `launch` again. Do not drive a stale instance.

## Drive

Use the recipes in [features/README.md](features/README.md) and the feature files. Conventions:

- Address the browser as `agent-browser --session verify-sentry-owner …` or `--session verify-sentry-member …`.
- Prefer accessible names and data attributes: `find role button click --name "…"`, `[data-test-id="onboarding-step-<id>"]`, `button[aria-label="Copy agent prompt"]`.
- Wait on text or URL (`wait --text "…"`, `wait --url "…"`) or on a JS condition (`wait --fn "…"`). Do not use `wait --load networkidle`: the setup page polls forever and never goes idle.
- Inspect stored state after every step that might create or delete a project: `sentry_dev.py state <org> --out <evidence>/<step>.json`.
- Send a first event with `sentry_dev.py event <org> <project-slug>`. It sends an error through Relay with the project's DSN, the way an SDK does.
- Play the coding agent with `fake_agent.py`. It reads the handoff code from a HAR of the `Copy agent prompt` click, claims it at `/agent-handoff.md`, redeems the setup code at `/oauth/token/`, reports each stage to `/onboarding/agent/status/`, creates a project through the public API, sends an error, waits for the issue, and completes. `--stop-after <stage>` leaves the run in progress, `--fail-at <stage>` fails it, and `--delay <seconds>` spaces the reports so the UI can be watched.

## Evidence

Write every artifact to `.artifacts/verify-sentry/<run-id>/<feature>/` in the checkout (gitignored). `doctor` prints the path. agent-browser needs absolute paths.

- UI proof is a screenshot plus `snapshot -i` output saved to a `.aria.txt` file, taken after the action and after the result appears.
- Every project mutation has a `state` JSON before and after it. A page that looks right is not proof that the project and DSN exist.
- Agent proof includes the HAR of the copy click and the `fake_agent.py --out` transcript.
- Name each artifact after the claim ID it proves, and report each claim as pass or fail with the artifact path.
- Use the real user path. Do not call internal setters, and do not create the onboarding project through the API, unless the claim is about an API.

HAR files and transcripts contain handoff codes and OAuth tokens for the local instance. They are single-use and local, but do not paste them into PRs or issues.

## Cleanup

```bash
.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py stop
agent-browser --session verify-sentry-owner close
agent-browser --session verify-sentry-member close
agent-browser --session verify-sentry-owner-2 close   # if a deep-link recipe opened it
```

`stop` kills only the process group and children recorded in `run.json`, then removes `/tmp/verify-sentry/{conf,run.json,seed.json}`. It keeps the devserver log and the evidence directory. Never kill by process name: `pkill -f` matches the shell that runs it. Seeded orgs stay in the local database; that is harmless, because every seed uses a new suffix. Leave `devservices` up unless you started it for this run.

## Helpers

- `scripts/sentry_dev.py launch|doctor|seed|login|state|event|stop`. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py <command> --help` for options.
- `scripts/fake_agent.py --org <org> --team <team> (--har <copy.har> | --code <sntryh_…>) --out <transcript.json> [--base-url http://dev.getsentry.net:8000] [--project-name <slug>] [--platform javascript-react] [--stop-after <stage>] [--fail-at <stage>] [--delay <seconds>]`. It exits non-zero with the failing request when a call is refused, and otherwise prints a JSON summary with `run_status`, `project_slug`, `event_id`, and `issue_ids`.

## Map

[features/README.md](features/README.md) indexes the feature files. Cite a claim as `<file>#<id>`, for example `navigation-state#inapp-back-keeps-project`. Claims state intended behavior. A claim that the product fails today carries a `Fails today` note with the run that observed it. Remove the note when a run proves the claim, and never edit the claim to match a bug.
