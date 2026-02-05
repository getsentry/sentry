# Source Map Configuration Issue Detection - Technical Spec

## Overview

**Problem:** When users have misconfigured source maps, their stack traces show minified code instead of original source. Today, users only discover this when they navigate to an event and notice the problem - our existing tools (processing errors banner, source maps debugger wizard) are **reactive**.

**Solution:** Proactively detect source map configuration issues from processing errors and create trackable issues in the Issues stream. This enables:
- Proactive notification - users learn about the problem without stumbling on it
- Seer/LLM assistance for resolution
- Trackable progress on fixing configuration problems

## Existing Systems for Processing Errors

These are the current tools users have for discovering and debugging source map issues:

### Processing Errors Banner (on Event Details)

Alert banner at the top of event detail pages that shows processing errors.

**API:** `GET /projects/{org}/{project}/events/{event_id}/actionable-items/`

**How it works:**
- Fetches processing errors from event data and filters/prioritizes them
- Shows expandable list of errors with metadata

**Note:** Most JS/sourcemap errors are hidden from this banner, so users often don't see them.

### Source Maps Debugger Wizard (on Event Details)

Modal that opens when clicking on a minified stack frame.

**API:** `GET /projects/{org}/{project}/events/{event_id}/source-map-debug-blue-thunder-edition/`

**How it works:**
- Per-frame analysis of why source mapping failed
- Returns detailed diagnostics: SDK version, debug ID support, uploaded artifacts, scraping attempts
- UI shows three resolution paths with progress indicators:
  - **Debug IDs tab** - modern approach with debug IDs
  - **Releases tab** - legacy release-based artifact matching
  - **Hosting Publicly tab** - scraping from public URLs
- Checklist-style troubleshooting with pass/fail for each step

**Frontend:** `static/app/components/events/interfaces/sourceMapsDebuggerModal.tsx`

For the issue detail UI, we can potentially reuse or adapt the wizard experience, linking to a representative event that demonstrates the problem.

---

## Architecture

### Symbolicator Error Types

When Sentry processes a JavaScript error, symbolicator attempts to apply source maps to convert minified stack traces back to original source code. When this fails, symbolicator returns specific error types that tell us what went wrong:

| symbolicator_type | `EventError` type | meaning |
|-------------------|-------------------|---------|
| `missing_sourcemap` | `js_no_source` | Can't find the `.map` file for a minified JS file. The sourcemap URL may be specified in the file (via `//# sourceMappingURL=`) or inferred, but the file isn't available. |
| `missing_source` | `js_no_source` | Found the sourcemap, but it references original source files (via `sources: ["src/app.js", ...]`) that aren't available. Happens when sourcemap doesn't include `sourcesContent` and source files weren't uploaded separately. |
| `missing_source_content` | `js_missing_sources_content` | Found the sourcemap, but its `sourcesContent` array is empty or missing. Similar to `missing_source` - the sourcemap exists but we can't show original code. |
| `scraping_disabled` | `js_scraping_disabled` | Project has source map scraping disabled, so we can't fetch sourcemaps from the web. User must upload sourcemaps directly. |
| `malformed_sourcemap` | `js_invalid_source` | Sourcemap exists but is invalid or not parseable. User uploaded a broken sourcemap. |
| `invalid_location` | `js_invalid_sourcemap_location` | Sourcemap has invalid line/column mappings. The sourcemap doesn't correctly map to the minified code. |

**Deferred - transient/fetch errors (TODO for future):**
These errors may be transient (server issues) rather than configuration problems. Consider handling separately:
- `FETCH_GENERIC_ERROR` / `FETCH_INVALID_HTTP_CODE` - server returned error when fetching
- `FETCH_TIMEOUT` - request timed out
- `FETCH_TOO_LARGE` - file too large to fetch
- `JS_TOO_MANY_REMOTE_SOURCES` - hit rate limit on fetching

### Issue Types

We'll create one GroupType (`sourcemap_configuration`) for all sourcemap configuration issues. See Fingerprinting Strategy below for rationale.

### Fingerprinting Strategy

Fingerprinting determines how sourcemap issues are grouped. There are two orthogonal decisions:

#### Decision 1: Error Granularity

Should we create separate issues for different error types, or group all sourcemap problems together?

**Option: Separate issues by error type**
- `sourcemap_missing_sourcemap` - can't find the .map file
- `sourcemap_missing_source` - sourcemap missing source content
- `sourcemap_scraping_disabled` - scraping is off
- etc.

**Option: Single issue for all sourcemap problems (Recommended)**
- One `sourcemap_configuration` issue type regardless of specific error
- Rationale: Users don't care *why* sourcemaps aren't working—they just want them fixed. The existing wizard covers all resolution paths (Debug IDs, Releases, Hosting Publicly) in one UI. Separating by error type creates noise without actionable distinction.

#### Decision 2: Scope Granularity

Should we create one issue per project or one issue per domain?

**Option: Per-project (Recommended)**
- Fingerprint: `{project_id}:sourcemap`
- One issue covers ALL sourcemap problems across all domains
- Simpler: fewer issues to track, one place to see "sourcemaps are broken"
- Aligns with how users think about the problem—"my project's sourcemaps aren't working"
- Auto-resolves when ALL sourcemaps in the project work

**Option: Per-domain**
- Fingerprint: `{project_id}:sourcemap:{url_host}`
- Separate issue for each domain (e.g., `app.example.com`, `cdn.example.com`)
- More granular tracking—each domain's issue resolves independently
- Could create noise if project has many domains with issues
- Example: `123:sourcemap:app.example.com` groups all sourcemap errors for `https://app.example.com/*`

**Note:** This choice impacts issue lifecycle—see Issue Lifecycle Management below.

---

### Issue Lifecycle Management

Configuration issues differ from runtime errors in how their lifecycle should be managed. There are two main patterns in Sentry:

**Error/Event Style** (e.g., N+1 queries)
- Each detected problem sends an occurrence to the issue platform
- Issues accumulate occurrences over time
- Users control the lifecycle: manually mark resolved when they believe it's fixed
- If the problem recurs after resolution, the issue is unresolved (regression)
- Works well for: problems that may be fixed in code but could regress

**Metric/Uptime/Crons Style** (e.g., uptime monitors, metric alerts)
- Detector monitors for a condition (e.g., "site is down", "error rate > threshold")
- When condition is met → issue is created/unresolved
- When condition clears → issue is auto-resolved
- Users have less control over lifecycle; the system reflects current state
- Works well for: problems with clear "fixed" vs "broken" states

**Recommendation: Metric/Uptime/Crons Style**

Sourcemap issues are closer to metric/uptime/crons style because:
- They represent a configuration state ("sourcemaps are broken") not individual events
- There's a clear "fixed" signal: successful sourcemap processing
- Users shouldn't need to manually resolve; when they fix the config, the issue should auto-resolve
- Unlike N+1 queries, there's no "regression" concern—either sourcemaps work or they don't

**Auto-resolution trigger options:**

| Trigger | Pros | Cons |
|---------|------|------|
| X successful events processed | Clear positive signal | May take time if low traffic |
| 0 failures in time window | Catches edge cases | Could resolve prematurely during low traffic |
| Both: X successes AND 0 failures | Most robust | More complex |

**Error type transitions**

If a project goes from `missing_sourcemap` to `invalid_sourcemap` (user uploaded broken sourcemaps), the issue should stay open without additional notifications. The issue represents "sourcemaps aren't working" regardless of the specific failure mode. Only resolve when we see successful processing.

**Lifecycle granularity**

With the recommended per-project fingerprint, the single project issue only resolves when ALL sourcemaps work. This is appropriate because:
- It gives users one clear signal: "your sourcemaps are fixed" vs "still broken"
- Partial fixes (one domain working) don't close the issue prematurely
- Alternative (per-domain): Each domain's issue would resolve independently, but this creates more noise

---

## Implementation Notes

- Create new GroupType (`sourcemap_configuration`) for sourcemap configuration issues
- Add detection logic in `post_process_group` pipeline, triggered for ERROR category events
- Filter out `chrome-extension:` URLs (users can't control browser extension sourcemaps)
- Store event_id in evidence data so the issue detail UI can link to the existing wizard
- For the issue detail UI, we can potentially reuse or adapt the existing wizard experience
- Feature flag: `organizations:processing-issues-detection`

The detection function should be generic and extensible - sourcemap issues are the first case, but the architecture should support adding handlers for other processing error types in the future.

---

## Rollout Strategy

Create a "test" version of the GroupType first:
- Issues are created but notifications are disabled
- Issues don't appear in the default issue stream
- Enable visibility for our team only via feature flag
- Evaluate issues in the UI before broader rollout

Once validated, change the `type_id` for the production GroupTypes. This effectively soft-deletes all test issues, so customers get fresh issues with notifications enabled and don't miss alerts.

---

## Open Questions

### Aggregation of Processing Errors

**Problem:** Different events surface different missing sourcemap files depending on which frames are in their stack trace. Event A might report `app.js.map` missing, Event B might report `vendor.js.map` missing. Over time, we'd accumulate a full picture of what's broken, but this doesn't fit cleanly into the occurrence model.

The occurrence model is designed for "a specific thing happened at a specific time" - each occurrence has its own evidence data. There's no built-in way to aggregate evidence across occurrences into a unified view.

**Options:**

1. **Accept occurrence model as-is** - Each occurrence captures what that specific event was missing. Users browse occurrences to see different files. The issue groups them together; the specifics vary per occurrence.

2. **Simplified diagnosis** - Don't enumerate every missing file. Just surface "your sourcemaps aren't configured" with a sample of missing URLs. The value is in alerting users to the problem, not cataloging every file.

3. **Aggregate at query time** - Store per-occurrence evidence normally, but build UI that queries all occurrences for an issue and aggregates evidence for display.

4. **Separate data store** - Store aggregated processing errors in a separate data source (e.g., a dedicated table or Redis). The issue links to this aggregated data rather than relying on occurrence evidence.

**Recommendation for team discussion:** Which approach balances implementation complexity vs. user value? Is cataloging all missing files important, or is "you have a sourcemap problem" sufficient?

### Should we create issues for `scraping_disabled`?

The processing errors banner hides most JS/sourcemap errors from users. `JS_SCRAPING_DISABLED` was explicitly hidden ([PR #54494](https://github.com/getsentry/sentry/pull/54494)) with this rationale: "since a user has to manually turn scraping off, we shouldn't show an error just to tell them that it's off after they turned it off."

Should we follow the same logic for issue creation?

**Arguments for including it:**
- If user disabled scraping but isn't uploading sourcemaps, they may not realize their stack traces are broken
- The issue could prompt them to either re-enable scraping or set up uploads

**Arguments against:**
- If they intentionally disabled scraping and don't want sourcemaps, creating issues is noise
- Respects the user's conscious choice

**Possible middle ground:** Only create an issue if scraping is disabled AND no sourcemaps have been uploaded for the project.

### UI and Notification Customization

These issues are fundamentally different from error issues - they're configuration/setup problems rather than runtime errors. The default issue UI, emails, and Slack notifications may not be well-suited for them.

**Existing wizard:** The source maps debugger wizard (on event details) appears when clicking on minified stack frames. It provides a checklist-style troubleshooting flow with progress indicators. This wizard requires an event ID.

**Questions:**
- Should we reuse/adapt the existing wizard for these issues? (It's per-frame; we'd need per-issue adaptation)
- What should the issue detail page show? (e.g., wizard-style fix instructions, links to docs)
- Should email/Slack notifications be customized? (e.g., different template, different frequency)
- Should these issues appear in the main issue stream or a separate "setup issues" view?
- How do we avoid alert fatigue for ongoing configuration problems?

---

## Future Iterations (not in MVP)

1. **Heuristic detection:** Detect minified code without sourcemap reference
2. **CDN filtering:** Domain-based filtering for known CDN/analytics providers
3. **Root cause diagnosis:** Integrate `source_map_debug()` to provide MISSING_RELEASE, DIST_MISMATCH, etc.
4. **Seer integration:** LLM-powered fix suggestions
