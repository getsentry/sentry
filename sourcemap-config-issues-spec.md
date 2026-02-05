# Source Map Configuration Issue Detection - Technical Spec

## Overview

Detect JavaScript source map configuration issues from processing errors and create trackable issues in the Issues stream. This enables:
- Proactive notification of misconfigured source maps
- Seer/LLM assistance for resolution
- Trackable progress on fixing configuration problems

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Detection trigger | `post_process_group` | Has access to full event with processing errors |
| Heuristics | Skip for MVP | Focus on high-confidence processing errors only |
| Filtering | `chrome-extension:` only | Browser extensions are outside user control |

---

## Architecture

### Symbolicator Error Types

These are the error types returned by symbolicator when source map processing fails:

| symbolicator_type | meaning |
|-------------------|---------|
| `missing_sourcemap` | Can't find the `.map` file for a minified JS file. The sourcemap URL may be specified in the file (via `//# sourceMappingURL=`) or inferred, but the file isn't available. |
| `missing_source` | Found the sourcemap, but it references original source files (via `sources: ["src/app.js", ...]`) that aren't available. Happens when sourcemap doesn't include `sourcesContent` and source files weren't uploaded separately. |
| `missing_source_content` | Found the sourcemap, but its `sourcesContent` array is empty or missing. Similar to `missing_source` - the sourcemap exists but we can't show original code. |
| `scraping_disabled` | Project has source map scraping disabled, so we can't fetch sourcemaps from the web. User must upload sourcemaps directly. |

### Issue Types (new GroupTypes)

| type_id | slug | source | user action |
|---------|------|--------|-------------|
| 12001 | `sourcemap_missing_sourcemap` | `missing_sourcemap` | Upload sourcemaps with release |
| 12002 | `sourcemap_missing_source` | `missing_source`, `missing_source_content` | Include `sourcesContent` in sourcemaps or upload source files |
| 12003 | `sourcemap_scraping_disabled` | `scraping_disabled` | Upload sourcemaps instead of relying on fetching |

**Note:** `missing_source` and `missing_source_content` map to the same issue type since they have the same resolution.

**Note:** The existing `source_map_debug()` function diagnoses root causes (MISSING_RELEASE, NO_URL_MATCH, DIST_MISMATCH, etc.) but requires DB queries. For MVP, we create issues from raw processing errors and let Seer/LLMs help diagnose root causes.

### Detection Flow

```
post_process_group (ERROR category)
         |
         v
+-------------------------+
| detect_sourcemap_issues |  (new step in pipeline)
|                         |
| 1. Check platform=js    |
| 2. Extract errors[]     |
| 3. Filter to sourcemap  |
|    errors only          |
| 4. Create IssueOccurrence|
|    with fingerprint     |
+-------------------------+
```

### Fingerprinting Strategy

| Issue Type | Fingerprint | Rationale |
|------------|-------------|-----------|
| `sourcemap_missing_sourcemap` | `{project_id}:sourcemap:missing:{url_host}` | Group by domain to avoid per-file noise |
| `sourcemap_missing_source` | `{project_id}:sourcemap:no_source:{url_host}` | Group by domain (covers both `missing_source` and `missing_source_content`) |
| `sourcemap_scraping_disabled` | `{project_id}:sourcemap:scraping_disabled` | Project-wide issue |

Example: `123:sourcemap:missing:app.example.com` groups all missing sourcemap errors for `https://app.example.com/*` files.

---

## Implementation

### Files to Create

1. **`src/sentry/issues/grouptype/sourcemap.py`**
   - Define `SourcemapMissingSourcemapType`, `SourcemapMissingSourceType`, `SourcemapScrapingDisabledType`
   - Inherit from `GroupType` dataclass pattern
   - Use `GroupCategory.INSTRUMENTATION` (already exists, id=18)

2. **`src/sentry/tasks/sourcemap_issues.py`**
   - `detect_sourcemap_config_issues(event, job)` function
   - Extract processing errors from `event.data.get("errors", [])`
   - Filter to sourcemap-related errors (`symbolicator_type in [missing_sourcemap, missing_source, missing_source_content, scraping_disabled]`)
   - Map `missing_source` and `missing_source_content` to the same issue type
   - Call `save_issue_occurrence()` with appropriate fingerprint

3. **`tests/sentry/tasks/test_sourcemap_issues.py`**
   - Test detection logic
   - Test fingerprinting
   - Test filtering (chrome-extension should not create issues)

### Files to Modify

1. **`src/sentry/tasks/post_process.py`**
   - Add `detect_sourcemap_config_issues` to `GROUP_CATEGORY_POST_PROCESS_PIPELINE[GroupCategory.ERROR]`
   - Add feature flag check: `features.has("organizations:sourcemap-config-issues", ...)`

2. **`src/sentry/features/temporary.py`**
   - Add `"organizations:sourcemap-config-issues"` feature flag

### Key Code Patterns

**GroupType definition** (following existing patterns in `src/sentry/issues/grouptype/`):
```python
@dataclass(frozen=True)
class SourcemapMissingSourcemapType(GroupType):
    type_id = 12001
    slug = "sourcemap_missing_sourcemap"
    description = "Source maps are missing for JavaScript code"
    category = GroupCategory.INSTRUMENTATION.value
    noise_config = NoiseConfig(ignore_limit=10)  # Don't alert on first occurrence
```

**IssueOccurrence creation** (following patterns in detectors):
```python
occurrence = IssueOccurrence(
    id=uuid4().hex,
    project_id=project_id,
    event_id=event.event_id,
    fingerprint=[f"{project_id}:sourcemap:missing:{url_host}"],
    issue_title="Missing source maps",
    subtitle=f"Source maps not found for {url_host}",
    evidence_data={"urls": affected_urls},
    evidence_display=[...],
    type=SourcemapMissingSourcemapType,
    detection_time=datetime.now(timezone.utc),
)
save_issue_occurrence(occurrence, event)
```

---

## Verification

1. **Unit tests:** Test detection logic with mocked event data
2. **Integration test:**
   - Create test event with `errors: [{symbolicator_type: "missing_sourcemap", ...}]`
   - Verify IssueOccurrence is created
   - Verify fingerprinting groups correctly
3. **Manual testing:**
   - Enable feature flag for test org
   - Send JS error without sourcemaps
   - Verify issue appears in Issues stream

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

---

## Future Iterations (not in MVP)

1. **Heuristic detection:** Detect minified code without sourcemap reference
2. **CDN filtering:** Domain-based filtering for known CDN/analytics providers
3. **Root cause diagnosis:** Integrate `source_map_debug()` to provide MISSING_RELEASE, DIST_MISMATCH, etc.
4. **Auto-resolution:** Detect when issue is fixed and auto-resolve
5. **Seer integration:** LLM-powered fix suggestions
