# Manual setup docs

The "Configure React SDK" page is where a user who set up manually gets their DSN and SDK snippet, picks products, waits for the first error, or skips out. React is the reference platform. In new-org onboarding it is `/onboarding/<org>/setup-docs/`; the getting-started page of an existing org is in `project-creation.md`.

## Claims

- `docs-sections` shows `Configure React SDK` with `Install`, `Configure SDK`, and `Verify` sections, and an npm/yarn/pnpm install snippet. Proof: `drive`.
- `dsn-matches-project` puts the DSN of the onboarding project's active key into the `Sentry.init` snippet. Proof: `drive`.
- `copy-dsn` copies that DSN to the clipboard and shows `DSN copied to clipboard`. Proof: `drive`.
- `products-selectable` lets the user turn on Tracing, Session Replay, Logs, and Application Metrics for a React project. Error Monitoring stays on and locked. Proof: `drive`.
- `product-toggle-updates-snippet` adds the product to the URL and its options to the snippet when the user turns it on, for example `product=performance-monitoring` and `tracesSampleRate` for Tracing. Proof: `drive`.
- `wait-for-first-event` shows `Waiting for error` until the first error arrives, then `Error Received` and `Take me to my error`, with no reload. Proof: `drive`.
- `skip-keeps-project` lets the user leave with `Skip setup`: a reason dialog, then the Issues page filtered to the onboarding project with setup guidance (`guidedStep=1`), and the project and DSN still exist. Proof: `drive`.

## How to get to it

- New-org onboarding: the shared recipe in `README.md` ends on this page.
- Deep link: `/onboarding/<org>/setup-docs/?product=error-monitoring` in a tab that already went through the flow. A fresh tab is covered by `navigation-state#deeplink-resumes`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. Run the shared recipe on a fresh org `O`, so the page shows `Configure React SDK`.
- `EV=$PWD/.artifacts/verify-onboarding/<run-id>/manual-setup-docs`.
- `$ST $O --out $EV/00-state.json` shows one `Active` project `javascript-react` with one DSN. Call that DSN `D`.

- **`docs-sections`: sections.** `$A snapshot -i > $EV/docs-sections.aria.txt` lists headings `Configure React SDK`, `Install`, `Configure SDK`, `Verify`, and buttons `npm`, `yarn`, `pnpm`. Save `$A screenshot --full $EV/docs-sections.png`.
- **`dsn-matches-project`: DSN in the snippet.** `$A eval "(document.body.innerText.match(/dsn: \"([^\"]+)\"/)||[])[1]"` prints `D`.
- **`copy-dsn`: copy.** `$A find role button click --name "Copy DSN"`. Within a second, `$A snapshot` contains `DSN copied to clipboard`. The paste check from `README.md` returns `D`.
- **`products-selectable`: product toggles.** `snapshot -i` shows checkboxes `Error Monitoring` (checked, disabled), and `Tracing`, `Session Replay`, `Logs`, `Application Metrics`, all unchecked and enabled.
- **`product-toggle-updates-snippet`: Tracing.** `$A find role checkbox click --name "Tracing"`. `$A get url` ends in `?product=error-monitoring&product=performance-monitoring`, and `$A eval "document.body.innerText.includes('tracesSampleRate')"` prints `true`. Repeat with `Session Replay`: the URL gains `product=session-replay` and the snippet contains `replaysSessionSampleRate`.
- **`wait-for-first-event`: first error.** `$A snapshot` contains `Waiting for error`. Run `.venv/bin/python .agents/skills/verify-onboarding/scripts/onboarding.py event $O javascript-react`. `$A wait --text "Error Received"` succeeds without a reload, and `snapshot -i` lists button `Take me to my error`.
- **`skip-keeps-project`: Skip setup.** On another fresh org at this page, `$A find role button click --name "Skip setup"`. Dialog `Skipping ahead?` lists reasons. `$A find role button click --name "I'll read the docs myself"`. `$A get url` is `/organizations/$O/issues/?guidedStep=1&project=<id>&referrer=onboarding-first-event-footer-skip`, and `$ST $O` still shows the project `Active` with DSN `D`.

## Gotchas

- Without `organizations:session-replay`, `organizations:ourlogs-enabled`, and `organizations:tracemetrics-enabled`, the Replay, Logs, and Metrics toggles render disabled. `launch` turns them on; a hand-rolled devserver that lacks them fails `products-selectable` for the wrong reason.
- Clipboard writes need the secure-origin flag that `login` passes to Chromium. In a session started any other way, `Copy DSN` writes nothing and `copy-dsn` fails for the wrong reason.
- The skip dialog's reasons are buttons with those labels; `[role="dialog"] button[aria-label="I got stuck"]` also works.
- `wait --load networkidle` never returns on this page, because it polls for the first event.

## Gaps

None.
