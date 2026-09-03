# Dedicated Chrome setup

Use a separate persistent Chrome directory so screenshot automation never controls a developer's everyday browser profile. Normal captures launch this profile headlessly, so they do not open or foreground a Chrome window.

## One-time setup

Launch the dedicated Chrome window only to authenticate or refresh an expired session:

```bash
open -na "Google Chrome" --args \
  --user-data-dir="$HOME/.sentry-ui-capture-chrome"
```

In that Chrome window:

1. Install the [Sentry Cookie Sync extension](https://github.com/getsentry/cookie-sync) by following its repository instructions.
2. Authenticate to Sentry manually. Never ask the developer to paste credentials into an agent conversation or terminal command.
3. Open the current dev-ui's actual `https://demo.dev.getsentry.net:<port>/` URL, sync cookies, and confirm the demo organization renders.

The directory persists cookies, extension state, and preferences across captures. Close the window after setup so the headless capture helper can use the profile. Manual intervention should otherwise be needed only when the corporate session expires.

## Verification

Run the capture helper normally. If dev-ui redirects to login, stop and ask the developer to refresh authentication in the dedicated window, close it, and retry. If the helper reports that the profile is already in use, ask the developer to close the dedicated window; do not close any browser process automatically.

## Security boundary

Do not use this profile for unrelated websites. Close its visible window after authentication, and delete the profile to remove the saved session. Never inspect or print cookies, unrelated local storage, authorization headers, passwords, or profile files. The capture helper accesses only `feature-flag-overrides` when a plan requests flags and restores its exact prior value.
