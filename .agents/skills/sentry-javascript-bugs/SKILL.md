---
name: sentry-javascript-bugs
description: 'Sentry JavaScript frontend bug pattern review based on real production errors. Use when reviewing React/TypeScript frontend code for common bug patterns. Trigger keywords: "javascript bug review", "frontend errors", "react error patterns", "sentry frontend bugs".'
allowed-tools: Read, Grep, Glob, Bash
---

# Sentry JavaScript Frontend Bug Pattern Review

Find bugs in Sentry frontend code by checking for the patterns that cause real production errors.

This skill encodes patterns from 428 real production issues (201 resolved, 130 ignored, 97 unresolved) generating over 524,000 error events across 93,000+ affected users. These are not theoretical risks -- they are the actual bugs that ship most often, with known fixes from resolved issues.

## Scope

You receive scoped code chunks from Warden's diff pipeline. Each chunk is a changed hunk (or coalesced group of nearby hunks) with surrounding context.

1. Analyze the chunk against the pattern checks below.
2. Use `Read` and `Grep` to trace data flow beyond the chunk when needed — follow component props, hook return values, API response shapes.
3. Report only **HIGH** and **MEDIUM** confidence findings.

| Confidence | Criteria                                                              | Action                       |
| ---------- | --------------------------------------------------------------------- | ---------------------------- |
| **HIGH**   | Traced the code path, confirmed the pattern matches a known bug class | Report with fix              |
| **MEDIUM** | Pattern is present but context may mitigate it                        | Report as needs verification |
| **LOW**    | Theoretical or mitigated elsewhere                                    | Do not report                |

## Step 1: Classify the Code

Determine what you are reviewing and load the relevant reference.

| Code Type                                                               | Load Reference                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Null/undefined property access, optional chaining, object destructuring | `${CLAUDE_SKILL_ROOT}/references/null-reference-errors.md`   |
| Dashboard widgets, chart visualization, widget URL generation           | `${CLAUDE_SKILL_ROOT}/references/dashboard-widget-errors.md` |
| Trace views, span details, trace tree rendering                         | `${CLAUDE_SKILL_ROOT}/references/trace-view-errors.md`       |
| API calls, response handling, error states, fetch wrappers              | `${CLAUDE_SKILL_ROOT}/references/api-response-handling.md`   |
| React hooks, context providers, render loops, component lifecycle       | `${CLAUDE_SKILL_ROOT}/references/react-lifecycle-errors.md`  |
| AI Insights, LLM prompt parsing, gen_ai span data                       | `${CLAUDE_SKILL_ROOT}/references/ai-insights-parsing.md`     |
| Array operations, date/time values, numeric formatting                  | `${CLAUDE_SKILL_ROOT}/references/range-and-bounds-errors.md` |

If the code spans multiple categories, load all relevant references.

## Step 2: Check for Top Bug Patterns

These are ordered by combined frequency and impact from real production data.

### Check 1: Null/Undefined Property Access -- 158 issues, 46,337 events

Code accesses a property on a value that may be null or undefined. This is the single most common bug pattern in the Sentry frontend.

**Red flags:**

- Accessing `.id`, `.slug`, `.name`, `.type`, `.match`, `.length`, `.charCodeAt` without null checks
- Using `object.property` instead of `object?.property` on data from API responses
- Passing API response data directly to utility functions without null validation
- Accessing DOM element properties from `querySelector` or `useRef` without checking if the element exists
- Destructuring objects from hooks/stores that may return null during loading states
- Calling `.dispatchEvent()` on elements that have been unmounted

**Safe patterns:**

- Optional chaining: `obj?.property?.nested`
- Default values: `const value = obj?.field ?? defaultValue`
- Null guards before function calls: `if (data) { parser.parse(data); }`
- Early returns for null/undefined parameters in utility functions

### Check 2: Dashboard Widget Input Validation -- 6 issues, 90,482 events

Widget visualization components throw when receiving data in unexpected formats.

**Red flags:**

- Rendering chart components without checking if data contains plottable values
- Calling `getWidgetExploreUrl()` for widget types that do not support multiple queries
- Passing undefined `field` values to `parseFunction()` or similar field parsers
- Not handling empty API responses in widget data fetchers

**Safe patterns:**

- Validate data shape before rendering: `if (!hasPlottableValues(data)) return <EmptyState />`
- Check widget query count before generating explore URLs
- Guard field parsers: `if (!field) return null`

### Check 3: Trace View Data Integrity -- 12 issues, 328,482 events

The trace tree renderer and trace detail views encounter data that violates structural assumptions.

**Red flags:**

- Building trace trees without cycle detection (or detecting cycles but not handling them gracefully)
- Looking up projects by ID from span data without checking if the project is accessible
- Generating trace links without validating `traceSlug` is non-empty
- Using `captureException` in render paths without deduplication (fires every render cycle)

**Safe patterns:**

- Break cycles by detaching cyclic nodes as orphan roots
- Validate traceSlug before generating links: `if (!traceSlug) return fallbackLink`
- Deduplicate error captures using a ref: `if (!capturedRef.current) { captureException(...); capturedRef.current = true; }`
- Check project access before rendering span details

### Check 4: API Response Shape Assumptions -- 31 issues, 24,019 events

Frontend code assumes API responses have a specific shape but the response is empty, undefined, or has an unexpected status code.

**Red flags:**

- Not handling 200 responses with empty bodies (e.g., `GET /customers/{orgSlug}/` returns 200 with no body)
- Not handling 402 (Payment Required) status codes in subscription flows
- Not handling 409 (Conflict) status codes in mutation endpoints
- Treating `UndefinedResponseBodyError` as unexpected (it indicates the API returned no parseable body)
- Assuming SelectAsync options will always load successfully

**Safe patterns:**

- Check response body before parsing: `if (!response.body) return null`
- Handle specific 4xx status codes in catch blocks
- Provide fallback empty states for failed API fetches instead of throwing

### Check 5: React Lifecycle Violations -- 10 issues, 2,595 events

Components violate React rendering rules, causing infinite loops or crashes.

**Red flags:**

- Setting state unconditionally in `useEffect` without proper dependency arrays
- Calling `useOrganization()` in components that render before organization context is loaded
- Using `useContext()` outside the provider boundary
- Passing objects as React children instead of strings/elements
- Components that trigger immediate re-render on mount

**Safe patterns:**

- Always provide dependency arrays for `useEffect`
- Guard context hooks: `const org = useOrganization(); if (!org) return <Loading />`
- Wrap organization-dependent routes in a provider boundary
- Validate element types before rendering: `if (typeof Component !== 'function') return null`

### Check 6: AI Insights Data Parsing -- 2 issues, 3,005 events

JSON parsing of AI prompt messages and gen_ai span data fails on non-standard formats.

**Red flags:**

- Calling `JSON.parse()` on `ai.prompt.messages` span attributes without try-catch
- Assuming all AI model responses produce valid JSON
- Not handling the "parts" format for multi-modal AI messages

**Safe patterns:**

- Wrap all `JSON.parse` calls on external data in try-catch
- Check for leading `[` or `{` before parsing
- Provide raw-text fallback rendering when parsing fails

### Check 7: Array and Bounds Validation -- 15 issues, 3,120 events

Array operations and numeric formatting with values that exceed valid ranges.

**Red flags:**

- Using `result.push(...largeArray)` (crashes when array is too large)
- Passing unclamped values to `toLocaleString({maximumFractionDigits: n})`
- Constructing Date objects from unvalidated timestamps
- Recursive component rendering without depth limits

**Safe patterns:**

- Use `concat` or iterative push for potentially large arrays
- Clamp numeric format parameters: `Math.min(100, Math.max(0, precision))`
- Validate dates before constructing: `if (isNaN(new Date(ts).getTime())) return fallback`
- Use iterative rendering with explicit stacks for deeply nested structures

### Check 8: Logic Correctness -- not pattern-based

After checking all known patterns above, reason about the changed code itself:

- Does every code path return the correct type (or JSX)?
- Are all branches of conditionals handled (especially missing `else` / default cases in switches)?
- Can any prop or state value (null, undefined, empty array, empty string) cause unexpected behavior?
- Are hook dependency arrays correct? Missing deps cause stale closures; extra deps cause infinite loops.
- If this component unmounts mid-async-operation, is cleanup handled?

Only report if you can trace a specific input that triggers the bug. Do not report theoretical concerns.

**If no checks produced a potential finding, stop and report zero findings. Do not invent issues to fill the report. An empty result is the correct output when the code has no bugs matching these patterns.**

Each code location should be reported once under the most specific matching pattern. Do not flag the same line under multiple checks.

## Step 3: Report Findings

For each finding, include:

- **Title**: Short description of the bug
- **Severity**: high, medium, or low
- **Location**: File path and line number
- **Description**: Root cause → consequences (2-4 sentences)
- **Precedent**: A real production issue ID (e.g., "Similar to JAVASCRIPT-2NQW: null charCodeAt in SQL parser, 39K events")
- **Fix**: A unified diff showing the code fix

Fix suggestions must include actual code. Never suggest a comment or docstring as a fix.

Do not prescribe your own output format — the review harness controls the response structure.
