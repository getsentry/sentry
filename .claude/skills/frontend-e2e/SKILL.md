---
name: frontend-e2e
description: Test frontend features in a real browser. Use when verifying UI changes, testing interactive features, checking for browser errors, or performing end-to-end testing of frontend code.
---

# Frontend E2E Browser Testing

Test frontend features in a real browser using Playwright MCP tools.

## Quick Start

1. Check if dev server is running
2. Start dev server if needed (runs in background)
3. Navigate to feature URL
4. Test the feature and check for errors

## Step 1: Check Dev Server Status

Check if the dev server is already running on port 7999:

```bash
lsof -i :7999 | grep LISTEN
```

If output shows a process listening, skip to Step 3.

## Step 2: Start Dev Server (if not running)

Start the dev server in the background:

```bash
NO_TS_FORK=1 pnpm dev-ui
```

Run this command with `run_in_background: true`. The server typically takes 30-60 seconds to compile.

**If port 7999 is in use by something else**, use a different port:

```bash
NO_TS_FORK=1 pnpm dev-ui -- --port 7998
```

**Wait for the server to be ready** by checking for "compiled successfully" in the output, or by attempting to navigate to the URL.

## Step 3: Navigate to Feature URL

**URL Format**: `https://<org>.dev.getsentry.net:<port>/<path>/`

- Default org: `sentry-test`
- Default port: `7999`

**Example URLs by feature area:**

| Feature     | URL Path         |
| ----------- | ---------------- |
| Replays     | `/replays/`      |
| Issues      | `/issues/`       |
| Performance | `/performance/`  |
| Alerts      | `/alerts/rules/` |
| Dashboards  | `/dashboards/`   |
| Discover    | `/discover/`     |
| Settings    | `/settings/`     |

Use `mcp__playwright__browser_navigate` to open the URL:

- URL: `https://sentry-test.dev.getsentry.net:7999/<path>/`

## Step 4: Handle Authentication

The user's web browser handles authentication to sentry.io via cookies. Users will have a "Cookie sync" browser extension installed that handles this.
After navigating:

1. **Check current URL** - If redirected to `*.sentry.io`, authentication is needed, or user is accessing incorrect org
2. **Wait for OAuth flow** - The browser may show a login page
3. **After auth**, you will need to navigate back to `*.dev.getsentry.net`
4. **Verify** the final URL contains `dev.getsentry.net` before proceeding

If stuck on sentry.io after auth:

- Manually navigate back to the dev URL using the org from the production URL (`<org>.sentry.io`)
- Warn the user if the org is `sentry` as that is production data
- The auth cookie should now be valid

## Step 5: Test the Feature

Use Playwright MCP tools to interact with the page:

### Navigation

- `mcp__playwright__browser_navigate` - Go to a URL
- `mcp__playwright__browser_snapshot` - Get current page state/accessibility tree

### Interaction

- `mcp__playwright__browser_click` - Click elements (use accessibility labels or selectors)
- `mcp__playwright__browser_type` - Type into input fields
- `mcp__playwright__browser_fill_form` - Fill form fields
- `mcp__playwright__browser_select_option` - Select dropdown options
- `mcp__playwright__browser_press_key` - Press keyboard keys

### Verification

- `mcp__playwright__browser_take_screenshot` - Capture visual state
- `mcp__playwright__browser_console_messages` - Check for JS errors
- `mcp__playwright__browser_network_requests` - Monitor API calls

### Waiting

- `mcp__playwright__browser_wait_for` - Wait for elements or conditions

## Testing Checklist

Use this checklist for thorough testing:

### Basic Functionality

- [ ] Page loads without errors
- [ ] No console errors (check `browser_console_messages`)
- [ ] Key UI elements are visible (use `browser_snapshot`)
- [ ] Take baseline screenshot

### Interactive Testing

- [ ] Click primary action buttons
- [ ] Fill and submit forms
- [ ] Test navigation between views
- [ ] Verify data displays correctly

### Error Handling

- [ ] Check for network request failures
- [ ] Verify error states render properly
- [ ] Test edge cases (empty states, loading states)

### Visual Verification

- [ ] Take screenshots of key states
- [ ] Compare before/after if making visual changes

## Common Issues

### "Connection refused" on dev URL

- Dev server not running or still compiling
- Check the background task output for errors
- Try port 7999 directly: `curl -k https://localhost:7999`

### Stuck on authentication

- Clear browser state and retry
- Check if sentry.io login is working
- Verify mkcert certificates are installed

### Page loads but shows errors

- Check `browser_console_messages` for JS errors
- Check `browser_network_requests` for failed API calls
- The dev server may need to be restarted

### Slow page loads

- First load after server start is slow (building assets)
- Subsequent loads should be faster
- Check for HMR (hot module reload) in console

## Example Test Session

Testing a new button on the Replays page:

1. Start/verify dev server is running
2. Navigate to `https://sentry-test.dev.getsentry.net:7999/replays/`
3. Handle auth if redirected
4. Take snapshot to verify page loaded
5. Use `browser_click` on the new button
6. Check console for errors
7. Take screenshot of result
8. Report findings

## Cleanup

After testing:

- Close the browser with `mcp__playwright__browser_close`
- Dev server can remain running for future tests
- To stop dev server, kill the background task
