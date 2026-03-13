# A/B Testing / Experimentation Framework for Sentry

## Context

Sentry has **flagpole** for feature flags (on/off + percentage rollout with deterministic bucketing), but no standard experimentation framework. Teams do ad-hoc experiments (e.g., code-review experiments gate on a flagpole flag, then Seer picks variant internally). We want a general system any team can use to define experiments (control vs treatment), assign orgs to cohorts, and track exposures.

**Primary randomization unit**: Organization (all users in an org see the same variant — standard for B2B).

---

## Decision 1: Build vs Buy

### Option A: Build on Flagpole

Extend flagpole's existing infrastructure to support experiments (control vs treatment).

**What exists today that we'd reuse:**

- Deterministic bucketing: SHA1 hash of org_id/project_id → `context.id % 100` (`flagpole/conditions.py:243-253`)
- Condition evaluation: `Segment.match()` with operators (in, not_in, equals, contains, etc.)
- Context builders: org properties, project properties, user properties, subscription data (`sentry/features/flagpole_context.py`, `getsentry/feature_handlers/getsentry_flagpole_context_builder.py`)
- YAML config via options-automator with per-region overrides
- Options-backed storage with Redis caching

**What we'd need to build:**

- Experiment lifecycle management (draft → running → completed)
- Exposure tracking (analytics events when variant is checked)
- Potentially a facts table for assignment persistence (see Decision 2)
- Convention/tooling around how to define an experiment vs a regular feature flag (naming, registration, config)

Flagpole already handles the core assignment: `features.has()` returns True/False which maps directly to treatment/control.

**Tradeoffs:**
| Pro | Con |
|-----|-----|
| No new vendor dependency on critical evaluation path | Must build statistical analysis ourselves (or add it later) |
| Reuses 80% of existing infrastructure | Engineering investment to build + maintain |
| Full control over assignment logic | No built-in experiment dashboard/reporting |
| No additional cost | No guardrails (p-value calculations, power analysis, etc.) |
| Works in all deployment modes (SaaS, single-tenant, self-hosted) | Need to build admin UI from scratch |
| Keeps all data in-house | |

### Option B: Third-Party Analysis Platform

We evaluated the four platforms from the meeting notes. The key constraint: **flagpole stays as the assignment system**. The third party handles analysis and dashboards. The integration model is: `experiment.check()` resolves assignment via flagpole, then we push exposure + outcome events to the third party's API.

**Note on "existing Statsig integration":** The `StatsigProvider` in `sentry/flags/providers.py` is a **customer-facing product feature** (Sentry's customers who use Statsig can see their flag changes in Sentry's UI via webhooks). It's irrelevant to our internal experimentation needs — no Statsig SDK is installed, and Sentry doesn't use Statsig for its own flags.

#### Statsig

Best fit for API-push integration. Statsig has first-class support for "analytics-only experiments" where assignment happens externally and you just send them exposure + outcome data.

**How it would work with flagpole:**

1. Define the experiment in the Statsig console (groups, metrics)
2. Flagpole assigns orgs to control/treatment as usual
3. `experiment.check()` pushes exposure to Statsig via HTTP API or Python SDK
4. Outcome events (e.g., "org adopted feature X") are pushed to Statsig
5. Statsig handles stats + dashboards

**API for pushing data (no warehouse needed):**

- `POST https://events.statsigapi.net/v1/log_custom_exposure` — send exposures with `experimentName`, `user`, and `group` (control/treatment)
- `POST https://events.statsigapi.net/v1/log_event` — send outcome events with `eventName`, `user`, optional `value` and `metadata`
- Python SDK: `statsig.manually_log_experiment_exposure(user, "experiment_name")` and `statsig.log_event(user, "purchase", value=29.99)`

**Stats**: CUPED, sequential testing, SRM checks, power calculator, guardrail metrics.
**Pricing**: Free tier (2M events/mo), then usage-based. Proprietary SaaS.

#### GrowthBook

OSS (MIT core). Supports external assignment, but the analysis engine is fundamentally SQL-based — it queries a data warehouse.

**Two integration paths:**

1. **GrowthBook Cloud (Managed Warehouse)**: They host a ClickHouse instance and provide a push API (`POST https://us1.gb-ingest.com/track`). You send exposure + outcome events, they store and analyze. No warehouse setup on our end.
2. **Self-hosted**: Requires connecting your own data warehouse (BigQuery, ClickHouse, etc.). GrowthBook pulls data via SQL. This only works if our exposure/outcome data already lands in a warehouse.

**Stats**: CUPED, sequential testing, Bayesian + Frequentist, SRM checks.
**Self-hostable**: Yes (MIT core), but self-hosted requires a warehouse.
**Pricing**: Free tier (unlimited experiments). Pro: $40/user/mo. Per-seat, predictable.

#### Optimizely

Has an Event API (`POST https://logx.optimizely.com/v1/events`) that supports pushing both exposure (decision) and conversion events. However:

- Complex payload structure (nested visitors/snapshots/decisions, need to map to Optimizely's internal campaign/experiment/variation IDs)
- Enterprise pricing (~$36K-180K+/yr)
- External assignment support exists but is not the primary design

**Assessment**: Works but more friction and cost than Statsig. Not recommended.

#### SwitchFeat

**Not suitable.** Despite marketing itself as "feature flags and A/B testing," the codebase only contains basic boolean feature flags — no experiment support, no statistical analysis, no event ingestion API, no published SDKs. It's a solo-developer prototype from mid-2023 that appears abandoned (last meaningful commit August 2023, website and docs are offline).

#### Summary

|                                  | Statsig                | GrowthBook                  | Optimizely                          | SwitchFeat |
| -------------------------------- | ---------------------- | --------------------------- | ----------------------------------- | ---------- |
| Push data via API (no warehouse) | Yes                    | Cloud only                  | Yes                                 | No         |
| External assignment support      | First-class            | Supported                   | Supported                           | No         |
| Self-hostable                    | No                     | Yes (needs warehouse)       | No                                  | Yes        |
| API simplicity                   | Simple (flat JSON)     | Simple (flat JSON)          | Complex (nested, need internal IDs) | N/A        |
| Pricing                          | Free tier + usage      | Free + $40/user/mo          | ~$36K-180K+/yr                      | Free       |
| Stats                            | CUPED, sequential, SRM | CUPED, sequential, Bayesian | Sequential, FDR control             | None       |

### Option C: Build Assignment + Use Third Party for Analysis

Build the assignment and exposure tracking on flagpole, push exposure + outcome data to a third-party platform (Statsig or GrowthBook Cloud) for statistical analysis and dashboarding. No warehouse layer needed.

The integration point is `experiment.check()`: when it records an exposure, it also pushes to the third party's API. Outcome events are pushed separately (either from `analytics.record()` or dedicated callsites).

**Tradeoffs:**
| Pro | Con |
|-----|-----|
| No external dependency on critical path (assignment is flagpole) | External dependency for analysis/dashboards |
| Full control over assignment | Must keep third party's experiment definitions in sync with flagpole |
| Get real statistical analysis + dashboard without building it | Two systems to understand/debug |
| Can swap analysis backend later | Pushing events adds latency (can be async/fire-and-forget) |
| Statsig has a free tier; GrowthBook is OSS | |

---

## Decision 2: Flagpole `experiment_mode`

Flagpole flags gain an optional `experiment_mode` key. When present, the flag is treated as an experiment — same assignment mechanism (`features.has()`), but with additional experiment-specific behavior (exposure tracking, Amplitude integration, frontend experiment data).

### Config

```yaml
# In options-automator flagpole.yaml
'feature.organizations:experiment-scm-onboarding':
  enabled: true
  owner:
    team: 'growth'
  experiment_mode: simple # <-- new field
  created_at: '2026-03-13'
  segments:
    - name: 'eligible paid orgs'
      rollout: 50
      conditions:
        - property: subscription_is-free
          operator: equals
          value: false
```

**Values for `experiment_mode`:**

- Not present / `none` — regular feature flag, no experiment behavior
- `simple` — control (flag off) vs active (flag on). This is the only mode we need now, but the enum design allows expansion to multi-variant later if needed.

### What `experiment_mode: simple` enables

1. **Org serializer includes experiment assignments** — flags with `experiment_mode` are evaluated and sent in the `"experiments"` dict on the org response (e.g., `{"experiment-scm-onboarding": "active"}`). The stub `"experiments": {}` already exists in the serializer from the old system.

2. **Feature registration** — experiment flags are registered in `temporary.py` like any other flag, with `api_expose=True`. They appear in `organization.features` as usual, AND in `organization.experiments` with their assignment value.

3. **Exposure tracking** — when the experiment assignment is observed (frontend or backend), an exposure is logged (see "Exposure Tracking" section below).

### Flagpole `Feature` dataclass change

Add `experiment_mode` to the `Feature` dataclass (`src/flagpole/__init__.py`):

```python
@dataclasses.dataclass(frozen=True)
class Feature:
    name: str
    owner: OwnerInfo
    enabled: bool = True
    segments: list[Segment] = dataclasses.field(default_factory=list)
    created_at: str | None = None
    experiment_mode: str | None = None  # "none", "simple", or None
```

Parse it in `from_feature_dictionary()`, update the JSON schema, and add it to `to_dict()`. The `match()` method is unchanged — `experiment_mode` doesn't affect evaluation, only how the result is interpreted and tracked.

### Scope: Org and Project

The primary unit is organization. Project-scoped experiments work the same way — flagpole already supports project-level evaluation via `features.has("projects:experiment-foo", project)`. The `experiment_mode` key is flag-level, so it applies regardless of scope. If we include project experiments in the serializer, they'd go in a project-level response. For now, org-scoped is the priority; project support comes for free from flagpole but the serializer/exposure plumbing is org-only initially.

---

## Decision 3: Exposure Tracking

### Prior Art: The Old Experiment System

Sentry previously had a full experiment framework (removed Dec 2023 in `getsentry/getsentry@8594e8d` and `sentry/sentry#90359`). It used Facebook's PlanOut library for randomization, but the exposure tracking and Amplitude integration patterns are directly reusable:

**Backend (`getsentry/experiments/base.py`):**

- `log_exposure()` did two things:
  1. `analytics.record("experiment.triggered", ...)` — backend event, goes through daily batch to Amplitude
  2. `log_experiment_assignment()` via threaded executor — **real-time** HTTP calls to Amplitude:
     - `group_identify` with `$set` to set experiment as org group property (e.g., `experiment_ExampleExperiment: ["exposed:1"]`)
     - A deduped `"Triggered Experiment (Deduped)"` event using `insert_id` for dedup

**Frontend (`static/gsApp/`):**

- Org serializer included `"experiments": {...}` — all active experiments evaluated server-side, sent with org data
- `useExperiment(experimentName)` hook read from `organization.experiments[key]`
- On mount (by default), called `logExperiment()` which POSTed to `/_experiment/log_exposure/`
- Local storage tracked which experiments had been logged to avoid repeat calls
- `ExperimentLogExposureEndpoint` at `/_experiment/log_exposure/` called `log_exposure()` on the backend

**Key insight: the old system solved the same frontend problem we have.** The frontend can't log exposure directly from `organization.features.includes()` because that's just an array lookup with no hook point. The old system used a separate `organization.experiments` dict + a dedicated `useExperiment()` hook that logged exposure on mount.

### Proposed Exposure Tracking (reviving the old pattern)

**Backend:**

1. **`log_experiment_exposure(experiment_name, org, assignment)`** — same dual-path as old system:
   - `analytics.record("experiment.exposure", ...)` for the batch pipeline
   - Real-time `group_identify` call to Amplitude with `$set` to set the experiment group property immediately (partial merge — doesn't touch other properties)
   - Deduped trigger event via `insert_id`

2. **`/_experiment/log_exposure/` endpoint** — revived for frontend exposure logging. Receives `{experiment_name, organization_id}`, calls `log_experiment_exposure()`.

3. **On `features.has()` for experiment flags** — when backend code checks an experiment flag, log exposure automatically. This is opt-in via `experiment_mode` on the flag — regular flags are unaffected.

**Frontend:**

1. **`organization.experiments`** — the org serializer evaluates all `experiment_mode` flags and includes them: `{"experiment-scm-onboarding": "active"}` (or `"control"`). The `"experiments": {}` stub already exists.

2. **`useExperiment(experimentName)` hook** — revived. Returns the assignment from `organization.experiments[key]` and logs exposure via `/_experiment/log_exposure/`. Logs on mount by default (configurable via `logExperimentOnMount: false`). Uses localStorage dedup to avoid repeat calls.

3. **The `organization.features.includes()` problem** — this is the tricky part. Code that checks experiment flags via the features array will work (the flag is in both `features` and `experiments`), but won't log exposure. Two approaches:
   - **Recommended**: For experiment-gated UI, use `useExperiment()` instead of `organization.features.includes()`. This is explicit and mirrors the old pattern.
   - **Fallback**: If existing code already uses `features.includes()` and we can't change it, the org serializer still fires `group_identify` for both treatment and control orgs — so Amplitude has the data. You just don't get explicit exposure logging for that specific code path.

### Real-time Amplitude `group_identify`

The real-time `group_identify` call on exposure solves the timing problem. Whenever an org checks an experiment flag — whether the result is `active` or `control` — we call `group_identify` with `$set` to set the experiment group property in Amplitude. This is a **partial merge** — it only sets the experiment property without touching existing properties like `plan`, `total_arr`, etc.

**Both treatment and control orgs get the call.** The org serializer evaluates all experiment flags for every org on every authenticated request. So any org that loads the app will have their experiment properties set in Amplitude almost immediately. This means:

- Amplitude has full visibility into both groups — no blind spot for control orgs
- Frontend events (sent directly to Amplitude via JS SDK) carry the experiment label from the first page load
- No dependency on any batch DAG for experiment properties
- Much less data than syncing all orgs via ETL — only orgs that actually use the product get the call

---

## Amplitude as the Analysis Layer

Sentry already sends product analytics to Amplitude (frontend events via the JS SDK, subscription events via PubSub). The ETL pipeline (`etl/etl/operators/amplitude_group_props.py`) already syncs org group properties to Amplitude daily — properties like `plan`, `org_size`, `is_early_adopter`, `integrations`, `total_arr`, etc. It does this by querying BigQuery (which has replicas of Sentry DB tables) and pushing to Amplitude via the `group_identify` API.

This means we can push experiment cohort membership as an org group property in Amplitude (e.g., `experiment_scm_onboarding: "treatment"`), and analysts can use Amplitude's native segmentation to compare metrics between treatment and control. No custom analysis tooling needed.

### How backend analytics events reach Amplitude today

Backend analytics events already flow to Amplitude through an existing ETL pipeline:

1. `analytics.record(event)` → PubSub → BigQuery (`super-big-data.analytics.events_denormalized`)
2. The `amplitude-analytics` DAG (runs daily at 4 AM UTC, `etl/workspace/dags/amplitude-analytics.py`) reads from BigQuery, aggregates events, and pushes to Amplitude via `insert_batch_events()`

So backend events reach Amplitude, just not in real-time — there's a daily batch step. Frontend events go directly via the Amplitude JS SDK.

**Note:** Amplitude quota is ~500k events/day for all analytics events (`etl/documentation/amplitude_analytics.md`). Experiment exposure events need to stay within this budget.

### How experiment data gets to Amplitude

**Real-time `group_identify` on exposure.** When any org checks an experiment flag (via the org serializer on page load, `useExperiment()`, or backend `features.has()`), we call Amplitude's `group_identify` API with `$set` to set the experiment group property (e.g., `experiment_scm_onboarding: "active"` or `"control"`). This is a partial merge — doesn't touch other org properties.

Both treatment and control orgs get the call. Since the org serializer runs on every authenticated request, any active org gets their experiment properties set on first page load.

**Existing ETL DAG as optional fallback.** The `amplitude-group-props` DAG (daily at 6:45 AM) could be extended to also sync experiment data as a safety net, but this is not required for v1 — the real-time path covers any org that loads the app.

---

## How Analysis Works

### Amplitude (primary)

Group properties set real-time on exposure via `group_identify`. Analysts segment any chart by `experiment_scm_onboarding = active` vs `control` using Amplitude's native segmentation.

**Temporal behavior:** Amplitude snapshots group properties onto events at ingestion time ([docs](https://amplitude.com/docs/data/user-properties-and-events)). Historical events retain old values — updates are prospective only ([group identify API](https://amplitude.com/docs/apis/analytics/group-identify)). This means:

- Once the experiment property is set (via real-time `group_identify`), all subsequent events carry the label permanently
- Events ingested _before_ the property was set will NOT have the label — this is why real-time `group_identify` on first page load matters
- When the experiment ends and the property is removed, historical events still have it for analysis
- Since both treatment and control orgs get the `group_identify` call on first page load, the gap between signup and property-set is minimal (first authenticated request)

### BigQuery (via exposure events)

Exposure events (`analytics.record("experiment.exposure", ...)`) land in BigQuery via the existing PubSub → `events_denormalized` pipeline. These contain `(experiment_name, organization_id, assignment, timestamp)` for every org that was exposed.

The `daily_organizations` facts table (`etl/workspace/dags/sql/facts_v2/daily_organizations.sql`) can join against the most recent exposure event per org to include experiment assignments:

```sql
LEFT JOIN (
  SELECT organization_id, experiment_name, assignment,
    ROW_NUMBER() OVER (PARTITION BY organization_id, experiment_name
                       ORDER BY timestamp DESC) as rn
  FROM events_denormalized
  WHERE event_type = 'experiment.exposure'
) exp ON exp.organization_id = o.organization_id AND exp.rn = 1
```

This gives the facts table experiment data without any new tables or Celery tasks — just joining against events that are already flowing. The assignment reflects the last time the org loaded the app, which for active orgs is effectively current state.

**Limitation:** If an experiment is deleted (flag removed from options-automator), the last exposure event still shows the old assignment. Inactive orgs may also carry stale assignments. This is the same limitation as Amplitude — both reflect "last known state" rather than "current ground truth."

### Experiment cleanup (future enhancement)

When an experiment ends, stale group properties remain in Amplitude and stale exposure events remain in BigQuery. The old experiment system didn't handle this — removing the experiment from `ACTIVE_EXPERIMENTS` just stopped new exposures.

For v1, this is acceptable — analysts stop querying ended experiments. If stale properties become noisy, a cleanup job in ETL can:

1. Call `group_identify` with `$unset` for the experiment property on affected orgs (queryable from exposure events in BigQuery)
2. Optionally write a "experiment ended" event so the facts table can filter

### Sentry SDK Integration (for debugging)

Attach experiment assignments to Sentry error events so that when investigating an issue, you can see which experiments were active for that org.

```python
# In sentry/utils/flag.py
def record_experiment_assignment(name: str, variant: str) -> None:
    sentry_sdk.feature_flags.add_feature_flag(f"experiment.{name}", variant)
```

Cheap and orthogonal — add from the start.

---

## Recommendation

### Decision 1: Build on Flagpole (Option A)

Flagpole already handles the hard part (deterministic assignment with eligibility targeting). `features.has()` returning True/False _is_ experiment assignment. What's missing is: knowing which orgs are in which experiments (for analysis), conventions around defining experiments, and exposure tracking.

**Why not third-party (Option B)?** Statsig's value is statistical analysis and dashboards. Real capabilities, but adopting a net-new vendor adds complexity. We can pipe data to Statsig later once we have experiment data flowing — starting with Statsig doesn't save us from building the assignment + exposure tracking layer.

### Decision 2: `experiment_mode` on flagpole flags

Add an optional `experiment_mode` field to flagpole's `Feature` dataclass. In `simple` mode, flag on = `active`, flag off = `control`. This:

- Requires no new assignment infrastructure — flagpole's deterministic hash is the assignment
- Is extensible to multi-variant later via new `experiment_mode` values
- Makes experiment intent explicit in the flag config (vs naming conventions alone)

### Decision 3: Revive the old exposure tracking pattern

The old experiment system (removed Dec 2023) solved exactly the problems we face — especially frontend exposure tracking. We revive:

- **`organization.experiments` dict** in the org serializer (stub already exists)
- **`useExperiment()` hook** on the frontend with localStorage dedup
- **`/_experiment/log_exposure/` endpoint** for frontend → backend exposure calls
- **Real-time `group_identify`** to Amplitude on exposure (sets experiment property immediately)

For backend experiments, exposure is logged automatically when `features.has()` is called for a flag with `experiment_mode` set.

### Decision 4: Analysis via Amplitude + BigQuery exposure events

- **Amplitude**: Real-time `group_identify` sets experiment properties on exposure. Analysts use native segmentation.
- **BigQuery**: Exposure events (`analytics.record()`) land in `events_denormalized` via existing PubSub pipeline. The `daily_organizations` facts table joins against the most recent exposure per org — no new tables, no Celery tasks, no Postgres replication.
- **Cleanup**: When an experiment ends, stale properties linger (same as old system). A future ETL job can `$unset` them in Amplitude if needed.

### Summary

| Decision          | Recommendation                                                                       | Reasoning                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Build vs Buy      | **Build on flagpole**                                                                | Flagpole handles assignment. Can plug in Statsig etc. later.                                                                 |
| Experiment config | **`experiment_mode` field on flagpole flags**                                        | Explicit, extensible, no new assignment infra.                                                                               |
| Exposure tracking | **Revive old pattern: org serializer + `useExperiment()` + `log_exposure` endpoint** | Proven pattern, solves the frontend exposure problem. Real-time `group_identify` for Amplitude.                              |
| Analysis          | **Amplitude + BigQuery**                                                             | Amplitude: real-time group properties. BigQuery: exposure events joined into daily facts table. No new tables or batch jobs. |

### Implementation plan

1. **Flagpole**: Add `experiment_mode` field to `Feature` dataclass, JSON schema, and `from_feature_dictionary()`. No behavior change for flags without it.
2. **Org serializer**: Populate `"experiments"` dict by evaluating all `experiment_mode` flags for the org. Map `True` → `"active"`, `False` → `"control"`. Fire `group_identify` to Amplitude for both groups (deduped).
3. **Frontend `useExperiment()` hook**: Reads from `organization.experiments`, logs exposure via `/_experiment/log_exposure/`. localStorage dedup.
4. **`/_experiment/log_exposure/` endpoint**: Calls `log_experiment_exposure()` which does `analytics.record()` + real-time `group_identify` to Amplitude.
5. **Backend exposure**: When `features.has()` is called for an experiment flag, auto-log exposure (via the existing `record_feature_flag` hook point or similar).
6. **Sentry SDK**: `record_experiment_assignment()` in `sentry/utils/flag.py`.

---

## Key Files

### Existing (to modify)

| File                                                | Role                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/flagpole/__init__.py`                          | `Feature` dataclass — add `experiment_mode` field                                |
| `src/flagpole/flagpole-schema.json`                 | JSON schema — add `experiment_mode` property                                     |
| `src/flagpole/conditions.py`                        | `Segment.match()`, `in_rollout()` — reuse for eligibility                        |
| `src/sentry/api/serializers/models/organization.py` | Org serializer — populate `"experiments"` dict (stub already exists at line 642) |
| `src/sentry/features/temporary.py`                  | Feature registration — register experiment flags with `api_expose=True`          |
| `src/sentry/utils/flag.py`                          | `record_feature_flag()` — add `record_experiment_assignment()`                   |

### New (to create)

| File                                   | Role                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `getsentry/experiments/exposure.py`    | `log_experiment_exposure()` — analytics event + real-time `group_identify` |
| `getsentry/web/experiment.py`          | `/_experiment/log_exposure/` endpoint (revived)                            |
| `static/gsApp/hooks/useExperiment.tsx` | `useExperiment()` hook (revived)                                           |
| `static/gsApp/utils/logExperiment.tsx` | Frontend exposure logging (revived)                                        |

### Prior art (removed, for reference)

| Commit / PR                              | What was removed                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getsentry/getsentry@8594e8d` (Dec 2023) | Backend experiment framework: `experiments/base.py` (PlanOut + Amplitude integration), `experiments/config.py` (experiment definitions), `web/experiment.py` (log_exposure endpoint)                    |
| `sentry/sentry#90359` (Apr 2025)         | Frontend experiment code: `experimentConfig.tsx`, `useExperiment.tsx`, `logExperiment.tsx`, `withExperiment.tsx`, `types/experiments.tsx`. Backend: `experiments/manager.py`, `experiments/__init__.py` |
| `sentry/sentry#90383` (Apr 2025)         | Backend cleanup: removed `ExperimentManager`, cleared `"experiments"` dict in org/user serializers                                                                                                      |

## Verification Plan

1. **Unit tests**: `experiment_mode` parsing in flagpole, org serializer includes experiments, exposure dedup logic
2. **Integration test**: Define experiment flag with `experiment_mode: simple` → verify org serializer returns correct assignment for both treatment and control → verify `useExperiment()` logs exposure → verify `group_identify` call fires
3. **Manual**: Create experiment flag in options-automator, verify Amplitude group property appears for both treatment and control orgs, verify segmentation works
