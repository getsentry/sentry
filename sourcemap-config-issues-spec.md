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
| Sampling | All events with JS processing errors | These are relatively rare; no need to sample |
| Heuristics | Skip for MVP | Focus on high-confidence processing errors only |
| Filtering | Use existing `node_modules`/`chrome-extension` filtering | Already applied in `map_symbolicator_process_js_errors()` |

### False Positive Filtering Analysis

**Current filtering** (already applied to processing errors in `processing.py:109-110`):
```python
def should_skip_missing_source_error(abs_path) -> bool:
    return "node_modules" in abs_path or abs_path.startswith("chrome-extension:")
```

**Coverage:**
- Bundled third-party libraries (`node_modules/`)
- Browser extensions (`chrome-extension:`)
- NOT covered: CDN-hosted libraries (e.g., `https://cdn.jsdelivr.net/...`)
- NOT covered: Analytics scripts (e.g., `https://www.google-analytics.com/...`)

**Recommendation for MVP:** Keep existing filtering. CDN-hosted scripts are:
1. Less common in modern apps (most use bundlers)
2. Users can resolve/dismiss individual issues
3. Adding CDN domain lists adds maintenance burden

**Future iteration:** Consider domain-based filtering or `in_app` correlation if noise becomes problematic.

---

## Architecture

### Issue Types (new GroupTypes)

For MVP, focus on the most common/actionable issue types derived from processing errors:

| type_id | slug | source | user action |
|---------|------|--------|-------------|
| 12001 | `sourcemap_missing_sourcemap` | `symbolicator_type: missing_sourcemap` | Upload sourcemaps with release |
| 12002 | `sourcemap_missing_source` | `symbolicator_type: missing_source` | Include source files or enable sourcesContent |
| 12003 | `sourcemap_scraping_disabled` | `symbolicator_type: scraping_disabled` | Upload sourcemaps instead of relying on fetching |

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
| `missing_sourcemap` | `{project_id}:sourcemap:missing:{url_host}` | Group by domain to avoid per-file noise |
| `missing_source` | `{project_id}:sourcemap:no_source:{url_host}` | Group by domain |
| `scraping_disabled` | `{project_id}:sourcemap:scraping_disabled` | Project-wide issue |

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
   - Filter to sourcemap-related errors (`symbolicator_type in [missing_sourcemap, missing_source, scraping_disabled]`)
   - Call `save_issue_occurrence()` with appropriate fingerprint

3. **`tests/sentry/tasks/test_sourcemap_issues.py`**
   - Test detection logic
   - Test fingerprinting
   - Test filtering (node_modules should not create issues)

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

## Future Iterations (not in MVP)

1. **Heuristic detection:** Detect minified code without sourcemap reference
2. **CDN filtering:** Domain-based filtering for known CDN/analytics providers
3. **Root cause diagnosis:** Integrate `source_map_debug()` to provide MISSING_RELEASE, DIST_MISMATCH, etc.
4. **Auto-resolution:** Detect when issue is fixed and auto-resolve
5. **Seer integration:** LLM-powered fix suggestions
