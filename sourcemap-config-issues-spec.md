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

| symbolicator_type | meaning |
|-------------------|---------|
| `missing_sourcemap` | Can't find the `.map` file for a minified JS file. The sourcemap URL may be specified in the file (via `//# sourceMappingURL=`) or inferred, but the file isn't available. |
| `missing_source` | Found the sourcemap, but it references original source files (via `sources: ["src/app.js", ...]`) that aren't available. Happens when sourcemap doesn't include `sourcesContent` and source files weren't uploaded separately. |
| `missing_source_content` | Found the sourcemap, but its `sourcesContent` array is empty or missing. Similar to `missing_source` - the sourcemap exists but we can't show original code. |
| `scraping_disabled` | Project has source map scraping disabled, so we can't fetch sourcemaps from the web. User must upload sourcemaps directly. |
| `malformed_sourcemap` | Sourcemap exists but is invalid or not parseable. User uploaded a broken sourcemap. |
| `invalid_location` | Sourcemap has invalid line/column mappings. The sourcemap doesn't correctly map to the minified code. |

**Deferred - transient/fetch errors (TODO for future):**
These errors may be transient (server issues) rather than configuration problems. Consider handling separately:
- `FETCH_GENERIC_ERROR` / `FETCH_INVALID_HTTP_CODE` - server returned error when fetching
- `FETCH_TIMEOUT` - request timed out
- `FETCH_TOO_LARGE` - file too large to fetch
- `JS_TOO_MANY_REMOTE_SOURCES` - hit rate limit on fetching

### Issue Types

Depending on the fingerprinting strategy chosen (see below), we'll create either:
- **One GroupType** for all sourcemap configuration issues (Option C - recommended)
- **Multiple GroupTypes** for different error categories (Options A/B)

### Fingerprinting Strategy

**Option A: Separate issue types by error category**

| Issue Type | Fingerprint | Rationale |
|------------|-------------|-----------|
| `sourcemap_missing_sourcemap` | `{project_id}:sourcemap:missing:{url_host}` | Group by domain |
| `sourcemap_missing_source` | `{project_id}:sourcemap:no_source:{url_host}` | Group by domain (covers `missing_source` and `missing_source_content`) |
| `sourcemap_scraping_disabled` | `{project_id}:sourcemap:scraping_disabled` | Project-wide issue |

**Option B: Single issue type for missing sourcemap/source errors**

| Issue Type | Fingerprint | Rationale |
|------------|-------------|-----------|
| `sourcemap_configuration` | `{project_id}:sourcemap:{url_host}` | All sourcemap errors for a domain go to one issue |
| `sourcemap_scraping_disabled` | `{project_id}:sourcemap:scraping_disabled` | Keep separate (different resolution) |

Option B rationale: `missing_sourcemap`, `missing_source`, and `missing_source_content` all funnel users through the same "set up source maps" workflow. Separating them may create noise without actionable distinction.

**Option C: Single issue type for ALL sourcemap problems**

| Issue Type | Fingerprint | Rationale |
|------------|-------------|-----------|
| `sourcemap_configuration` | `{project_id}:sourcemap:{url_host}` | All sourcemap errors including scraping go to one issue |

Option C rationale: The existing wizard covers all three resolution paths (Debug IDs, Releases, Hosting Publicly/scraping) in one UI. Users end up in the same troubleshooting flow regardless of error type. One issue per domain keeps things simple.

Example: `123:sourcemap:app.example.com` groups ALL sourcemap configuration errors for `https://app.example.com/*`.

**Recommendation: Option C.** Users don't care *why* their sourcemaps aren't working - they just aren't. Funnel them to one place and show them how to fix it. Simpler for users, simpler for us.

---

## Implementation Notes

- Create new GroupType(s) for sourcemap configuration issues
- Add detection logic in `post_process_group` pipeline, triggered for ERROR category events
- Filter out `chrome-extension:` URLs (users can't control browser extension sourcemaps)
- Store event_id in evidence data so the issue detail UI can link to the existing wizard
- For the issue detail UI, we can potentially reuse or adapt the existing wizard experience
- Feature flag: `organizations:processing-issues-detection`

The detection function should be generic and extensible - sourcemap issues are the first case, but the architecture should support adding handlers for other processing error types in the future.

---

## Rollout Strategy

Create "test" versions of the GroupTypes first:
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
4. **Auto-resolution:** Detect when issue is fixed and auto-resolve
5. **Seer integration:** LLM-powered fix suggestions
