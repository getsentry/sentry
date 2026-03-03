---
name: sentry-backend-bugs
description: 'Sentry backend bug pattern review based on real production errors. Use when reviewing Python/Django backend code for common bug patterns. Trigger keywords: "backend bug review", "common errors", "error patterns", "sentry bugs".'
allowed-tools: Read, Grep, Glob, Bash
---

# Sentry Backend Bug Pattern Review

Find bugs in Sentry backend code by checking for the patterns that cause the most production errors.

This skill encodes patterns from 638 real production issues (393 resolved, 220 unresolved, 25 ignored) generating over 27 million error events across 65,000+ affected users. These are not theoretical risks -- they are the actual bugs that ship most often, with known fixes from resolved issues.

## Scope

You receive scoped code chunks from Warden's diff pipeline. Each chunk is a changed hunk (or coalesced group of nearby hunks) with surrounding context.

1. Analyze the chunk against the pattern checks below.
2. Use `Read` and `Grep` to trace data flow beyond the chunk when needed — follow function calls, check callers, verify types at boundaries.
3. Report only **HIGH** and **MEDIUM** confidence findings.

| Confidence | Criteria                                                              | Action                       |
| ---------- | --------------------------------------------------------------------- | ---------------------------- |
| **HIGH**   | Traced the code path, confirmed the pattern matches a known bug class | Report with fix              |
| **MEDIUM** | Pattern is present but context may mitigate it                        | Report as needs verification |
| **LOW**    | Theoretical or mitigated elsewhere                                    | Do not report                |

## Step 1: Classify the Code

Determine what you are reviewing and load the relevant reference.

| Code Type                                                         | Load Reference                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| ORM queries, model lookups, `.objects.get()`, FK access           | `${CLAUDE_SKILL_ROOT}/references/missing-records.md`      |
| Type conversions, None handling, option reads, serializer returns | `${CLAUDE_SKILL_ROOT}/references/null-and-type-errors.md` |
| Data input parsing, field lengths, request bodies, decompression  | `${CLAUDE_SKILL_ROOT}/references/data-validation.md`      |
| `get_or_create`, `save()`, unique constraints, integer overflow   | `${CLAUDE_SKILL_ROOT}/references/database-integrity.md`   |
| Integration webhooks, external API calls, SentryApp hooks         | `${CLAUDE_SKILL_ROOT}/references/integration-errors.md`   |
| Dict iteration, shared state, concurrent access                   | `${CLAUDE_SKILL_ROOT}/references/concurrency-bugs.md`     |
| Snuba queries, metric subscriptions, search filters               | `${CLAUDE_SKILL_ROOT}/references/query-validation.md`     |
| Redirect URLs, URL construction, routing                          | `${CLAUDE_SKILL_ROOT}/references/url-safety.md`           |

If the code spans multiple categories, load all relevant references.

## Step 2: Check for Top Bug Patterns

These are ordered by combined frequency and impact from real production data.

### Check 1: Metric Subscription Query Errors -- 113 issues, 3,035,640 events

Alert and metric subscriptions referencing tags or functions that do not exist in the target dataset. These fire continuously once created.

**Red flags:**

- Creating Snuba subscriptions with `SubscriptionData` using user-provided query strings without validation
- Referencing `transaction.duration` in p95/p99 functions on the metrics dataset (it is a string type there)
- Using custom tag names (e.g., `customerType`) as filter dimensions without checking they exist
- Calling `resolve_apdex_function` without verifying the dataset supports threshold parameters

**Safe patterns:**

- Validate query fields against dataset schema before subscription creation
- Wrap `_create_in_snuba` calls with try/except `SubscriptionError` and mark subscription as invalid
- Use `IncompatibleMetricsQuery` checks before building metric subscription queries

### Check 2: Missing Record / Stale Reference -- 81 issues, 1,403,592 events

Code calls `.get()` on a Django model assuming the record exists, but it has been deleted, merged, or never created.

**Red flags:**

- `Model.objects.get(id=some_id)` without try/except for `DoesNotExist`
- `Detector.objects.get(id=detector_id)` in workflow engine without handling deletion
- `Environment.objects.get(name=env_name)` in monitor/cron consumers
- `Subscription.objects.get(id=sub_id)` in billing tasks
- Using `Group.objects.get()` with IDs from Snuba query results (groups may be deleted/merged)
- Chained lookups where second `.get()` fails

**Safe patterns:**

- `Model.objects.filter(...).first()` with a None check
- try/except `DoesNotExist` that returns a graceful fallback (404, skip, log)
- Queryset `.exists()` check before `.get()`
- In API endpoints: return 404 for `DoesNotExist`, 400 for validation errors. Never suggest returning 500 intentionally.

**Not a bug — do not flag:**

- Infrastructure invariants: `.get()` enforcing a deployment precondition (e.g., "default org must exist in single-org mode") should crash — a 500 signals misconfiguration, not a code defect.
- Already validated by parent: If the endpoint base class validates the object (e.g., `OrganizationEndpoint` resolves the org), don't flag `.get()` on related records unless there's a genuine race or deletion window. Read the endpoint's parent class before reporting.
- Configuration lookups: Code that loads required config objects (`get_default()`, settings-based lookups) is expected to fail hard if the config is wrong.

### Check 3: Search Query Validation -- 57 issues, 2,001,330 events

InvalidSearchQuery from user-provided or subscription-stored query filters referencing invalid values, deleted issues, or unresolved tags.

**Red flags:**

- `by_qualified_short_id_bulk()` called with short IDs from stored subscriptions that reference deleted/renamed projects
- `_issue_filter_converter` that calls `Group.objects.get()` on user-provided issue short IDs
- `resolve_tag_key()` called without checking the tag exists in the target dataset
- Passing unvalidated `query` strings from alert rule subscriptions to Snuba

**Safe patterns:**

- Validate short IDs before passing to `by_qualified_short_id_bulk()` -- handle `Group.DoesNotExist`
- Wrap `_issue_filter_converter` in try/except and return empty results for invalid filters
- Pre-validate tag existence against dataset schema

### Check 4: Value Validation Errors -- 45 issues, 1,000,624 events

ValueError from insufficient input validation: unpacking errors, invalid enum values, missing expected objects, and Pydantic/DRF validation failures.

**Red flags:**

- `SentryAppInstallation.objects.get()` in action builders assuming exactly 1 result exists
- `AlertRuleWorkflow` lookups by ID without handling `DoesNotExist`
- Tuple unpacking (`a, b, c = value.split(":")`) on strings that may have fewer separators
- Integer enum lookups without catching `ValueError` (e.g., `DetectorPriorityLevel(value)`)

**Safe patterns:**

- Validate expected count before `.get()`: use `.filter()` and check `.count()`
- Wrap tuple unpacking in try/except `ValueError` or validate length first
- Use `try: EnumClass(value) except ValueError:` for user-facing enum conversions
- In API endpoints: return 400 for `ValueError` and validation failures.

### Check 5: Type Errors -- 28 issues, 740,106 events

Wrong types passed to functions: iterating over non-iterables, invalid dict keys, None where object expected.

**Red flags:**

- `orjson.dumps(payload)` where payload dict may have non-string keys
- `list(setting)` where `setting` could be an int (from `project.get_option()`)
- `result["key"] = value` where `result` could be None
- Iterating over a value from DB/config that could be int or None instead of list

**Safe patterns:**

- Type-check before iteration: `isinstance(value, (list, str))` before `list(value)`
- Validate dict keys before JSON serialization: ensure all keys are strings
- None-guard before subscript assignment: `if result is not None:`
- Defensive option reads with type checking
- In API endpoints: return 400 for type mismatches from user input.

### Check 6: Internal API Request Errors -- 71 issues, 829,753 events

ApiError from internal Sentry API calls between services, often caused by stale subscription parameters.

**Red flags:**

- `api.client.get()` calls in metric alert chart rendering without handling 400 responses
- Internal API calls that forward stale subscription queries (referencing removed tags/metrics)
- `fetch_metric_alert_events_timeseries()` in `incidents/charts.py` without ApiError handling

**Safe patterns:**

- Wrap internal API calls with try/except `ApiError` and return graceful fallback
- Validate query parameters before making internal API requests
- Handle 400/500 responses explicitly in chart/visualization code

### Check 7: Database Constraint Violations -- 22 issues, 2,962,198 events

IntegrityError and DataError from integer overflow, foreign key violations, and unique constraint violations.

**Red flags:**

- Incrementing `times_seen` counter without bounding (integer overflow at ~2.1 billion)
- Deleting `MonitorCheckIn` records without handling FK constraints from `MonitorIncident`
- `UPDATE` on `GroupOpenPeriod` date ranges where lower bound can exceed upper bound
- `save()` on models with unique constraints without handling `IntegrityError`

**Safe patterns:**

- Cap integer fields before update: `min(value, 2_147_483_647)` for 32-bit int columns
- Use `CASCADE` or handle FK constraints before bulk deletion
- Validate date range bounds before saving
- try/except `IntegrityError` with fallback to `get()` or `update_or_create()`

### Check 8: Data Parsing & Deserialization -- 19 issues, 272,812 events

JSONDecodeError and ZstdError from parsing external data or stored compressed data.

**Red flags:**

- `json.loads(response.body)` without catching `JSONDecodeError`
- `zstd.decompress(data)` without handling corrupt frame descriptors
- Parsing VSTS/Azure DevOps webhook bodies that may be truncated
- Assuming API responses are always valid JSON (can be HTML error pages)

**Safe patterns:**

- Always wrap JSON/compression in try/except with graceful fallback
- Check `content-type` header before parsing
- Validate response status before parsing body

### Check 9: Missing Key Access (KeyError) -- 25 issues, 155,020 events

Accessing dictionary keys or HTTP headers without existence check.

**Red flags:**

- `request.META["HTTP_X_GITLAB_TOKEN"]` in webhook handlers (header may be absent)
- `request.META["HTTP_X_EVENT_KEY"]` in Bitbucket webhook handler
- Dict key lookups with `HANDLERS[event_type]` without checking the event type is registered
- Tuple unpacking from header values with variable-length splits

**Safe patterns:**

- `request.META.get("HTTP_X_GITLAB_TOKEN")` with None check
- `HANDLERS.get(event_type)` with fallback for unknown event types
- Validate required headers at the top of webhook handler before processing

### Check 10: Concurrency and Runtime Bugs -- 23 issues, 38,443 events

Dictionary mutation during iteration, shared mutable state, and unimplemented code paths.

**Red flags:**

- `for key in self._dict:` while another thread modifies it (RuntimeError)
- Publishing to shared `KafkaPublisher` dict that grows unbounded
- `dict.pop()` or `dict[key] = value` on a dict being iterated in another thread
- Missing `NotImplementedError` handlers for new search expression types

**Safe patterns:**

- `dict.copy()` before iteration
- Use `threading.Lock` for shared mutable state
- Implement all code paths before enabling features
- Use `list(dict.keys())` for safe iteration when mutation is needed

### Check 11: Logic Correctness -- not pattern-based

After checking all known patterns above, reason about the changed code itself:

- Does every code path return the correct type?
- Are all branches of conditionals handled (especially `else` / default cases)?
- Can any input (None, empty list, 0, empty string) cause unexpected behavior?
- Are there off-by-one errors in loops, slices, or range checks?
- If this code runs concurrently, is shared state protected?

Only report if you can trace a specific input that triggers the bug. Do not report theoretical concerns.

**Not a bug — do not flag:**

- `assert` statements enforcing infrastructure invariants — Sentry does not run with `python -O`, so assertions are always active. Crashing on a violated invariant is intentional.
- Speculative input concerns (e.g., "this URL could be too long", "this header could be malformed") unless you can show the input actually reaches the code path unvalidated. Check for existing validation (host checks, schema validation, DRF serializers) before reporting.

**If no checks produced a potential finding, stop and report zero findings. Do not invent issues to fill the report. An empty result is the correct output when the code has no bugs matching these patterns.**

Each code location should be reported once under the most specific matching pattern. Do not flag the same line under multiple checks.

## Step 3: Report Findings

For each finding, include:

- **Title**: Short description of the bug
- **Severity**: high, medium, or low
- **Location**: File path and line number
- **Description**: Root cause → consequences (2-4 sentences)
- **Precedent**: A real production issue ID (e.g., "Similar to SENTRY-5D9J: Detector.DoesNotExist, 610K events")
- **Fix**: A unified diff showing the code fix

Fix suggestions must include actual code. Never suggest a comment or docstring as a fix.

When suggesting fixes in API endpoints, use appropriate HTTP status codes (404 for not found, 400 for bad input, 409 for conflicts). Never suggest returning 500 intentionally.

Do not prescribe your own output format — the review harness controls the response structure.
