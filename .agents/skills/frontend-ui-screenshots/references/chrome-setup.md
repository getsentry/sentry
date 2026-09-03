# Dedicated Chrome setup

Use a separate persistent Chrome directory so screenshot automation never controls a developer's everyday browser profile. Normal captures connect to this dedicated Chrome over localhost while the app remains hidden, so capture does not open or foreground a window.

## One-time setup

Launch the dedicated Chrome window only to install Cookie Sync, authenticate, or refresh an expired session:

```bash
open -na "Google Chrome" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.sentry-ui-capture-chrome"
```

In that Chrome window:

1. Install the [Sentry Cookie Sync extension](https://github.com/getsentry/cookie-sync) by following its repository instructions.
2. Authenticate to Sentry manually. Never ask the developer to paste credentials into an agent conversation or terminal command.
3. Open the current dev-ui's actual `https://demo.dev.getsentry.net:<port>/` URL, sync cookies, and confirm the demo organization renders.

The directory persists cookies, extension state, and preferences across captures. Once setup succeeds, relaunch the same process hidden for normal capture:

```bash
open -g -j -na "Google Chrome" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.sentry-ui-capture-chrome"
```

This is a headful Chrome process because Cookie Sync does not authenticate in Chrome's automated headless context, but macOS keeps the application hidden and in the background. Manual intervention should otherwise be needed only when the corporate session expires.

The capture helper also hides the exact Chrome process listening on the configured CDP port before it opens a capture tab. This covers the common case where the visible one-time setup window was left running; it does not hide or control another Chrome process.

## Verification

Check the local endpoint without reading cookies:

```bash
curl --fail --silent http://127.0.0.1:9222/json/version
```

If it is unavailable, launch the hidden dedicated Chrome command above. If dev-ui redirects to login, stop and ask the developer to refresh authentication in the visible dedicated window, then relaunch it hidden.

## Security boundary

Anyone who can reach CDP can control the authenticated browser. Keep the address on `127.0.0.1`, do not expose or forward port 9222, and do not use this profile for unrelated websites. Quit the dedicated Chrome process to revoke active browser access, and delete the profile to remove the saved session. Never inspect or print cookies, unrelated local storage, authorization headers, passwords, or profile files. The capture helper accesses only `feature-flag-overrides` when a plan requests flags and restores its exact prior value.
