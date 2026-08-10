# Autofix Overview2 Card Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the `/issues/autofix/overview2` cards to show issue vitals (event/user counts, last-seen), a Seer-activity time, the milestone-driven action button (+ Review PR), and interactive priority & assignee selectors — powered by enriching the single `/seer/autofix-overview/` endpoint with a nested `issue` object and a per-run `pullRequests` list, windowed by a global `DatePageFilter`.

**Architecture:** Backend enriches each serialized run with (a) a nested `issue` object built by `StreamGroupSerializerSnuba(expand=["owners"], collapse=["lifetime","filtered","unhandled"])` over the already-in-hand `Group` objects, windowed via `start/end` + `environment_ids` from standard request-param parsing; and (b) a `pullRequests: [{number, url, status}]` list via a bulk `SeerRunPullRequest` join. Frontend adds a global `DatePageFilter`, threads the window into the query, and reuses the original page's `OverviewIssuePriority`, `OverviewIssueAssignee`, `IssueVitals`-style row, and `deriveCardAction`/`IssuePrimaryAction`.

**Tech Stack:** Django REST, `StreamGroupSerializerSnuba`, Snuba; React 19, TanStack Query + `apiOptions`, `@sentry/scraps`, existing overview widgets.

## Global Constraints

- Frontend (`static/`) and backend (`src/`, `tests/`) are not atomically deployed and normally require separate PRs. This branch (`feat/seer-autofix-overview2`) already intentionally carries both per an earlier explicit decision; continue on it. The FE/BE split CI check will flag the PR — user manages that.
- Comments/docstrings: MAX 2 lines, only where intent isn't self-evident. Default to none.
- Python via `.venv/bin/`; tests `-n0 --reuse-db` (add `--create-db` once when schema/nothing-changes matters; no migration here so not needed). `required_permissions: ['all']`.
- No customer data in code/tests/fixtures. No `Co-Authored-By`.
- Windowed counts: default window 14d (match issues feed) via global `DatePageFilter`; card count tooltip reads "in the last <window>".
- `pullRequests` is a per-run list (a run can open multiple PRs). It is the future attach point for GitHub CI/review/files enrichment (separate later effort) — do not collapse to singular.

---

## Response shape (target)

```jsonc
{
  "runsByMilestone": {
    "autofix_root_cause": [
      {
        "groupId": "199",
        "shortId": "SEER-TEST-SANDBOX-PYTHON-3C",
        "title": "gaierror: ...",
        "rootCause": {"oneLineDescription": "..."},
        "proposedFix": null,
        "seerRunId": "81e5...",
        "lastTriggeredAt": "2026-08-05T20:39:23Z",
        "pullRequests": [],
        "issue": {
          "count": "1234",
          "userCount": 56,
          "lastSeen": "2026-08-05T19:02:11Z",
          "level": "error",
          "substatus": "ongoing",
          "priority": "high",
          "priorityLockedAt": null,
          "issueType": "error",
          "issueCategory": "error",
          "assignedTo": {
            "type": "user",
            "id": "1",
            "name": "Jane",
            "email": "j@example.com",
          },
          "owners": [{"type": "suspectCommit", "owner": "user:1", "date_added": "..."}],
          "project": {
            "id": "4",
            "slug": "seer-test-sandbox-python",
            "platform": "python",
          },
        },
      },
    ],
    "autofix_solution": [/* proposedFix populated */],
    "autofix_code_changes": [],
    "has_pull_request": [/* pullRequests: [{number, url, status}] populated */],
    "pull_requests_merged": [],
  },
}
```

`issue` is always present. `assignedTo` is `null` when unassigned; `owners` is `[]` when none. `pullRequests` is `[]` unless the run opened PRs.

---

## Task 1: Backend — enrich runs with a nested `issue` object (windowed)

**Files:**

- Modify: `src/sentry/seer/endpoints/organization_seer_autofix_overview.py`
- Test: `tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py`

**Interfaces:**

- Consumes: existing `_latest_run_per_group`, `_serialize_run`, `_RunMilestones`.
- Produces: each run dict gains `"issue": {...}`; `get()` builds one bulk `serialize(groups, user, StreamGroupSerializerSnuba(...))` map keyed by group id string.

- [ ] **Step 1: Write failing test — issue vitals present and windowed**

Add to `tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py` a test in the existing class. Use existing helpers (`_run_for_group`, `create_group`). Store an event so counts are non-zero, or assert the keys exist with correct types:

```python
def test_run_includes_nested_issue_object(self):
    group = self.create_group()
    self._run_for_group(group, "the boom")
    with self.feature("organizations:seer-night-shift-ui"):
        resp = self.get_success_response(self.organization.slug)
    run = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
    issue = run["issue"]
    assert issue["project"]["id"] == str(group.project_id)
    assert issue["project"]["slug"] == group.project.slug
    assert issue["priority"] == "high"  # create_group default
    assert "count" in issue and "userCount" in issue and "lastSeen" in issue
    assert issue["assignedTo"] is None
    assert issue["owners"] == []
```

- [ ] **Step 2: Run it, verify it fails**

Run: `.venv/bin/pytest -n0 --reuse-db tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py::OrganizationSeerAutofixOverviewTest::test_run_includes_nested_issue_object -q`
Expected: FAIL — `KeyError: 'issue'`.

- [ ] **Step 3: Add imports + window parsing + serializer call**

In the endpoint, add imports:

```python
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.api.utils import get_date_range_from_stats_period
```

In `get()`, after building `groups`, parse the window and serialize in bulk:

```python
start, end = get_date_range_from_stats_period(request.GET)
environments = self.get_environments(request, organization)
serialized_by_id = {
    sg["id"]: sg
    for sg in serialize(
        list(groups.values()),
        request.user,
        StreamGroupSerializerSnuba(
            environment_ids=[e.id for e in environments],
            start=start,
            end=end,
            expand=["owners"],
            collapse=["lifetime", "filtered", "unhandled"],
            organization_id=organization.id,
            project_ids=[p.id for p in projects],
        ),
        request=request,
    )
}
```

`get_date_range_from_stats_period(request.GET)` defaults to 90d when no params (fine — always windowed; frontend sends 14d default). Pass `projects` into the loop or hoist `project_ids`.

- [ ] **Step 4: Pick issue fields in `_serialize_run`**

Change `_serialize_run(group, run)` → `_serialize_run(group, run, serialized_group)` and add:

```python
result["issue"] = {
    "count": serialized_group.get("count"),
    "userCount": serialized_group.get("userCount"),
    "lastSeen": serialized_group.get("lastSeen"),
    "level": serialized_group.get("level"),
    "substatus": serialized_group.get("substatus"),
    "priority": serialized_group.get("priority"),
    "priorityLockedAt": serialized_group.get("priorityLockedAt"),
    "issueType": serialized_group.get("issueType"),
    "issueCategory": serialized_group.get("issueCategory"),
    "assignedTo": serialized_group.get("assignedTo"),
    "owners": serialized_group.get("owners") or [],
    "project": {
        "id": str(group.project_id),
        "slug": group.project.slug,
        "platform": group.project.platform,
    },
}
```

Pass `serialized_by_id[str(group_id)]` at the call site in the loop.

- [ ] **Step 5: Run the test, verify pass**

Run: same nodeid as Step 2. Expected: PASS. Then run the whole file:
`.venv/bin/pytest -n0 --reuse-db tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py -q` — all pass.

- [ ] **Step 6: Typecheck + lint**

`SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run -q mypy --files src/sentry/seer/endpoints/organization_seer_autofix_overview.py --stage pre-push`
`.venv/bin/prek run -q ruff --files src/sentry/seer/endpoints/organization_seer_autofix_overview.py`

- [ ] **Step 7: Commit**

```bash
git add src/sentry/seer/endpoints/organization_seer_autofix_overview.py tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py
git commit -m "feat(seer): Enrich autofix overview runs with issue vitals"
```

---

## Task 2: Backend — add per-run `pullRequests` list

**Files:**

- Modify: `src/sentry/seer/endpoints/organization_seer_autofix_overview.py`
- Test: `tests/sentry/seer/endpoints/test_organization_seer_autofix_overview.py`

**Interfaces:**

- Consumes: `_RunMilestones.seer_run`, the run pks in `latest_run_per_group`.
- Produces: each run dict gains `"pullRequests": [{number:int, url:str|None, status:str}]`; a helper `_pull_requests_by_run_pk(run_pks) -> dict[int, list[dict]]`.

- [ ] **Step 1: Write failing test**

```python
def test_run_includes_pull_requests(self):
    group = self.create_group()
    run = self._run_for_group(group, "boom")
    repo = self.create_repo(project=group.project, name="getsentry/sentry")
    pr = self.create_pull_request(repository_id=repo.id, organization_id=self.organization.id, key="123")
    self.create_seer_run_pull_request(run=run, pull_request=pr)
    with self.feature("organizations:seer-night-shift-ui"):
        resp = self.get_success_response(self.organization.slug)
    run_data = resp.data["runsByMilestone"][SeerRunMilestoneType.ROOT_CAUSE][0]
    assert run_data["pullRequests"] == [
        {"number": 123, "url": pr.get_external_url() or None, "status": "open"}
    ]
```

(Confirm `create_seer_run_pull_request` / `create_repo` / `create_pull_request` fixture names exist — they're used in `test_milestones.py`.)

- [ ] **Step 2: Run it, verify fail**

Run the nodeid. Expected: FAIL — `KeyError: 'pullRequests'`.

- [ ] **Step 3: Implement the bulk PR join**

Add imports:

```python
from collections import defaultdict
from sentry.models.pullrequest import PullRequest
from sentry.seer.models.run import SeerRunPullRequest
```

Reuse `get_stored_pull_request_status` for status:

```python
from sentry.api.serializers.models.pullrequest import get_stored_pull_request_status
```

Helper (bulk, no N+1 for the query; `get_external_url` is per-PR but N is small):

```python
def _pull_requests_by_run_pk(run_pks: list[int]) -> dict[int, list[dict]]:
    by_pk: dict[int, list[dict]] = defaultdict(list)
    links = (
        SeerRunPullRequest.objects.filter(seer_run_id__in=run_pks)
        .select_related("pull_request")
        .order_by("date_added")
    )
    for link in links:
        pr = link.pull_request
        try:
            number = int(pr.key)
        except (TypeError, ValueError):
            continue
        by_pk[link.seer_run_id].append(
            {"number": number, "url": pr.get_external_url() or None,
             "status": get_stored_pull_request_status(pr.status)}
        )
    return by_pk
```

Verify the exact signature of `get_stored_pull_request_status` (it may take `pr.status` int; adjust). In `get()`, build `prs_by_run_pk = _pull_requests_by_run_pk([r.seer_run.id for r in latest_run_per_group.values()])` and set `result["pullRequests"] = prs_by_run_pk.get(run.seer_run.id, [])` inside `_serialize_run` (pass it in).

- [ ] **Step 4: Run test, verify pass** — same nodeid. Then whole file passes.

- [ ] **Step 5: Typecheck + lint** (same commands as Task 1 Step 6).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(seer): Add pull requests to autofix overview runs"
```

---

## Task 3: Frontend — extend types + add DatePageFilter and window query

**Files:**

- Modify: `static/app/views/seerWorkflows/overview2/types.ts`
- Modify: `static/app/views/seerWorkflows/overview2/index.tsx`
- Modify: `static/app/views/seerWorkflows/overview2/index.spec.tsx`

**Interfaces:**

- Produces: `OverviewRun` gains `issue: OverviewRunIssue` and `pullRequests: OverviewPullRequest[]`; the query sends `statsPeriod`/`start`/`end`/`environment` from `selection.datetime`.

- [ ] **Step 1: Extend types.ts**

Add:

```ts
import type {Actor} from 'sentry/types/core';
import type {SuggestedOwner} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
// PriorityLevel, IssueType, IssueCategory, Level as needed

export interface OverviewPullRequest {
  number: number;
  status: string;
  url: string | null;
}

export interface OverviewRunIssue {
  assignedTo: Actor | null;
  count: string;
  issueCategory: string;
  issueType: string;
  lastSeen: string;
  level: string;
  owners: SuggestedOwner[];
  priority: string | null;
  priorityLockedAt: string | null;
  project: {id: string; slug: string; platform?: PlatformKey};
  substatus: string | null;
  userCount: number;
}
```

Add to `OverviewRun`: `issue: OverviewRunIssue;` and `pullRequests: OverviewPullRequest[];`.

- [ ] **Step 2: Add DatePageFilter + thread window into query**

In `index.tsx`:

- Add `DatePageFilter` (import `sentry/components/pageFilters/datePageFilter`) into the `PageFilterBar` next to `ProjectPageFilter`.
- Set the page's default period: pass `defaultSelection={{datetime: {period: '14d', ...}}}` to `PageFiltersContainer` (match issues-feed default) — verify the prop; if not available, rely on `DatePageFilter` default and set the query fallback to `'14d'`.
- Extend the query to include the window from `selection.datetime`:

```ts
const {period, start, end, utc} = selection.datetime;
// query: {project, environment: selection.environments,
//   ...(period ? {statsPeriod: period} : {start, end, utc})}
```

Use the existing helper `normalizeDateTimeParams` if the pattern in the original page uses it — check `overview/useAutofixSections.tsx` for how it serializes the period.

- [ ] **Step 3: Update spec for the window param**

In `index.spec.tsx`, the existing "scopes the request to the selected project" test → extend or add a sibling asserting `statsPeriod` (or start/end) is sent. Mock stays the same (endpoint body unaffected by params in the mock). Keep the single-call guard test intact.

- [ ] **Step 4: Typecheck + test**

`pnpm run typecheck`
`pnpm test-ci static/app/views/seerWorkflows/overview2/index.spec.tsx`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(seer): Add date filter and issue types to overview2"
```

---

## Task 4: Frontend — vitals row + Seer time in the card

**Files:**

- Modify: `static/app/views/seerWorkflows/overview2/issueCard.tsx`
- Modify: `static/app/views/seerWorkflows/overview2/index.spec.tsx`

**Interfaces:**

- Consumes: `run.issue.count`, `userCount`, `lastSeen`; `run.lastTriggeredAt`.
- Produces: card renders event count, user count (when >0), last-seen, Seer-activity time.

- [ ] **Step 1: Failing test — card shows event count + last seen**

Add to `index.spec.tsx` (extend the fixtures with `issue` + `pullRequests`; make a shared fixture helper so all tests carry the new required fields). Assert:

```ts
expect(await screen.findByText('1.2K events')).toBeInTheDocument();
expect(screen.getByText(/events/)).toBeInTheDocument();
```

Give `rootCauseRun.issue.count = '1200'`, `userCount: 5`, `lastSeen: <iso>`.

- [ ] **Step 2: Run, verify fail** (`… events` not rendered).

- [ ] **Step 3: Implement vitals**

In `overview2/issueCard.tsx`, add a vitals row reusing the presentational approach from `overview/issueCard.tsx` `IssueVitals` (icons `IconGraph`, `IconUser`, `IconClock`, `IconSeer`; `formatAbbreviatedNumber`; `TimeSince`; `periodWindowLabel` from `overview/periods`). Event count always; user count only when `> 0`; last-seen `TimeSince`; keep the existing Seer-activity `TimeSince` on `lastTriggeredAt`. Tooltip window label uses the selected period (thread `statsPeriod` into the card or read from a small prop).

- [ ] **Step 4: Run test, verify pass.**

- [ ] **Step 5: Typecheck + lint + commit**

```bash
pnpm run typecheck && pnpm run lint:js static/app/views/seerWorkflows/overview2/issueCard.tsx
git commit -am "feat(seer): Show issue vitals on overview2 cards"
```

---

## Task 5: Frontend — action button (milestone-driven + Review PR)

**Files:**

- Modify: `static/app/views/seerWorkflows/overview2/issueCard.tsx`
- Modify: `static/app/views/seerWorkflows/overview2/index.spec.tsx`

**Interfaces:**

- Consumes: the card's section key (milestone→section already mapped in `types.ts`), `run.pullRequests[0]`.
- Produces: a right-rail primary action button per section; `Review PR #N` external link when a PR exists.

- [ ] **Step 1: Failing test**

Assert a `needs_investigation` card shows a `Create Plan` button, and a `has_pull_request` run with a PR shows a `Review PR #123` link with the PR url.

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

Reuse `deriveCardAction`/`IssuePrimaryAction` from `overview/cardAction.tsx` if cleanly importable; otherwise a small local `Overview2Action` that maps section → {label, icon, variant} for the four milestone-driven buttons, and renders an external `LinkButton` `Review PR #{n}` when `run.pullRequests[0]?.url`. Pass the card's `sectionKey` down (the section loop in `index.tsx` already knows it). No live status → no Running/Retry/Add context (out of scope).

- [ ] **Step 4: Run test, verify pass.**

- [ ] **Step 5: Typecheck + lint + commit**

```bash
git commit -am "feat(seer): Add action button to overview2 cards"
```

---

## Task 6: Frontend — priority + assignee selectors

**Files:**

- Modify: `static/app/views/seerWorkflows/overview2/issueCard.tsx`
- Modify: `static/app/views/seerWorkflows/overview2/index.spec.tsx`

**Interfaces:**

- Consumes: `run.issue` (priority + assignee fields), `run.groupId`.
- Produces: reused `OverviewIssuePriority` + `OverviewIssueAssignee` in the card's bottom-right.

- [ ] **Step 1: Failing test**

Assert the priority chip renders (e.g. `screen.getByRole('button', {name: /priority/i})` — confirm the accessible name from `GroupPriorityDropdown`) and the assignee control renders (unassigned avatar button). Mock any member query the assignee triggers: `GET /organizations/{org}/users/?project=...` → `[]` (AssigneeSelector self-fetches when `memberList` omitted).

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement**

Import `OverviewIssuePriority` from `overview/overviewIssuePriority` and `OverviewIssueAssignee` from `overview/overviewIssueAssignee`. Build their inputs from `run.issue`:

- Priority group object: `{id: run.groupId, priority, priorityLockedAt, issueType, issueCategory, level, lastSeen: '', count: run.issue.count, owners, assignedTo, project: {id}}` (analytics-only fields can be minimal; render-critical are `id, priority, priorityLockedAt, issueType, project.id`).
- Assignee: `<OverviewIssueAssignee groupId={run.groupId} projectId={issue.project.id} projectSlug={issue.project.slug} assignedTo={issue.assignedTo ?? undefined} owners={issue.owners} />` (omit `memberList` → self-fetch).

Place them in the card's bottom-right (mirror `overview/issueCard.tsx` layout). Note: their mutations invalidate the issues-index key (inert here) but keep local optimistic state — acceptable.

- [ ] **Step 4: Run test, verify pass.**

- [ ] **Step 5: Full verification**

`pnpm run typecheck`
`pnpm run lint:js <all overview2 files>`
`pnpm test-ci static/app/views/seerWorkflows/overview2/index.spec.tsx`
`pnpm test-ci static/app/views/seerWorkflows/overview/index.spec.tsx` (regression — original untouched)

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(seer): Add priority and assignee selectors to overview2 cards"
```

---

## Self-review notes

- **Spec coverage:** #1 event count (Task 4), #2 last-seen (Task 4), #3 Seer time (already; kept in Task 4), #4 action buttons (Task 5), #5 priority (Task 6), #6 assignee (Task 6). Windowing (Task 3). PR list (Task 2). ✅
- **Not in this plan (later):** GitHub GraphQL CI-status / review-decision / file-changes enrichment for the "review open PRs" section (separate research in flight); live run status (Running/Retry/Add context); focus mode; sort; table view.
- **Type consistency:** backend `issue.*` keys ↔ frontend `OverviewRunIssue` fields ↔ `OverviewIssuePriority`/`OverviewIssueAssignee` required props verified against the widget field research.
- **Risk:** `get_stored_pull_request_status` exact signature — verify at implementation. `PageFiltersContainer` default-period prop name — verify; fall back to query default `'14d'`.
