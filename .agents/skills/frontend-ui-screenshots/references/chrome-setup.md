# Dedicated Chrome setup

Use a separate persistent Chrome directory so screenshot automation never controls a developer's everyday browser profile.

## One-time setup

Launch Chrome on macOS with CDP restricted to localhost:

```bash
open -na "Google Chrome" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.sentry-ui-capture-chrome"
```

In that Chrome window:

1. Install the [Sentry Cookie Sync extension](https://github.com/getsentry/cookie-sync) by following its repository instructions.
2. Authenticate to Sentry manually. Never ask the developer to paste credentials into an agent conversation or terminal command.
3. Open `https://demo.dev.getsentry.net:7999/`, sync cookies, and confirm the demo organization renders.

The directory persists cookies, extension state, and preferences across restarts. Normal capture runs should start this Chrome automatically and require intervention only when the corporate session expires.

## Verification

Check the local endpoint without reading cookies:

```bash
curl --fail --silent http://127.0.0.1:9222/json/version
```

If it is unavailable, launch the dedicated Chrome command again. If dev-ui redirects to login, stop and ask the developer to refresh authentication in that window.

## Security boundary

Anyone who can reach CDP can control the authenticated browser. Keep the address on `127.0.0.1`, do not expose or forward port 9222, do not use this profile for unrelated websites, and close Chrome to revoke access. Never inspect or print cookies, local storage, authorization headers, passwords, or profile files.
