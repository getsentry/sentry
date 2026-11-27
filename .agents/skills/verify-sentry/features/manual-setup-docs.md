# Manual setup docs

The "Configure React SDK" page is where a user who set up manually gets their DSN and SDK snippet, picks products, waits for the first error, or skips out. React is the reference platform. In new-org onboarding it is `/onboarding/<org>/setup-docs/`; the getting-started page of an existing org is in `project-creation.md`.

## Sub-features

- `docs-sections` shows `Configure React SDK` with `Install`, `Configure SDK`, and `Verify` sections, and an npm/yarn/pnpm install snippet.
- `dsn-matches-project` puts the DSN of the onboarding project into the `Sentry.init` snippet.
- `copy-dsn` copies that DSN to the clipboard and confirms with `DSN copied to clipboard`.
- `product-toggles` lets the user turn on Tracing, Session Replay, Logs, and Application Metrics, with Error Monitoring always on, and each choice adds its options to the snippet.
- `wait-for-first-event` shows `Waiting for error` until the first error arrives, then `Error Received` and `Take me to my error`, without a reload.
- `skip-keeps-project` lets the user leave with `Skip setup` and lands on Issues for the onboarding project, which keeps its DSN.

## How to get to it (user POV)

- New-org onboarding: the shared recipe in `README.md` ends on this page.
- Deep link: `/onboarding/<org>/setup-docs/?product=error-monitoring` in a tab that already went through the flow. A fresh tab is `navigation-state.md` `deeplink-resumes`.

## Driving it with agent-browser

Preconditions:

- Baseline from `README.md`. Run the shared recipe on a fresh org `O`, so the page shows `Configure React SDK`.
- `EV=$PWD/.artifacts/verify-sentry/<run-id>/manual-setup-docs`.
- `$ST $O --out $EV/00-state.json` shows one `Active` project `javascript-react` with one DSN. Call that DSN `D`.

- **`docs-sections`: sections.** `$A snapshot -i > $EV/docs-sections.aria.txt` lists headings `Configure React SDK`, `Install`, `Configure SDK`, `Verify`, and buttons `npm`, `yarn`, `pnpm`. Save `$A screenshot --full $EV/docs-sections.png`.
- **`dsn-matches-project`: DSN in the snippet.** `$A eval "(document.body.innerText.match(/dsn: \"([^\"]+)\"/)||[])[1]"` prints `D`.
- **`copy-dsn`: copy.** `$A find role button click --name "Copy DSN"`. Within a second, `$A snapshot` contains `DSN copied to clipboard`. The paste check from `README.md` returns `D`.
- **`product-toggles`: products.** `$A snapshot -i > $EV/product-toggles.aria.txt` shows checkbox `Error Monitoring` checked and disabled, `Tracing` checked (carried over from the platform step), and `Session Replay`, `Logs`, `Application Metrics` unchecked and enabled. `$A find role checkbox click --name "Session Replay"`: `$A get url` gains `product=session-replay`, and `$A eval "document.body.innerText.includes('replaysSessionSampleRate')"` prints `true`. `$A find role checkbox click --name "Tracing"`: the URL loses `product=performance-monitoring`, and `$A eval "document.body.innerText.includes('tracesSampleRate')"` prints `false`.
- **`wait-for-first-event`: first error.** `$A snapshot` contains `Waiting for error`. Run `.venv/bin/python .agents/skills/verify-sentry/scripts/sentry_dev.py event $O javascript-react`. `$A wait --text "Error Received"` succeeds without a reload, and `snapshot -i` lists button `Take me to my error`.
- **`skip-keeps-project`: Skip setup.** On another fresh org at this page, `$A find role button click --name "Skip setup"`. Dialog `Skipping ahead?` lists reasons. `$A find role button click --name "I'll read the docs myself"`. `$A get url` is `/organizations/$O/issues/?guidedStep=1&project=<id>&referrer=onboarding-first-event-footer-skip`, and `$ST $O` still shows the project `Active` with DSN `D`.

## Gotchas

- `launch` turns on `organizations:session-replay`, `organizations:ourlogs-enabled`, and `organizations:tracemetrics-enabled`. On a devserver without them, the Replay, Logs, and Metrics toggles render disabled and `product-toggles` fails for the wrong reason.
- Clipboard writes need the secure-origin flag that `login` passes to Chromium. In a session started any other way, `Copy DSN` writes nothing and `copy-dsn` fails for the wrong reason.
- `wait --load networkidle` never returns on this page, because it polls for the first event.
