# A/B Testing / Experimentation Framework for Sentry

## Context

Sentry has **flagpole** for feature flags (on/off + percentage rollout with deterministic bucketing), but no standard experimentation framework. We want a general system any team can use to define experiments (control vs treatment), assign orgs to cohorts, and measure outcomes.

**Primary randomization unit**: Organization.

**First use case**: Onboarding experiment to encourage SCM integration setup — measure whether it hurts conversion.

## Design

### 1. Flagpole `experiment_mode`

Add an optional `experiment_mode` field to flagpole flags. When present, the flag is treated as an experiment with additional behavior (exposure tracking, Amplitude integration, frontend experiment data). The `match()` method is unchanged — `experiment_mode` doesn't affect evaluation, only how the result is interpreted and tracked.

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
- `simple` — control (flag off) vs active (flag on).
- Extensible to multi-variant later via new values.

**Implementation:** Add `experiment_mode: str | None` to the `Feature` dataclass in `src/flagpole/__init__.py`, update the JSON schema, parse in `from_feature_dictionary()`. Experiment flags are registered in `temporary.py` like any other flag with `api_expose=True`.

**Scope:** Org-scoped is the priority. Project-scoped experiments work the same way via flagpole but the serializer/exposure plumbing is org-only initially.

### Naming

The experiment name is derived from the flag name by stripping the scope prefix:

```
Flag: organizations:experiment-scm-onboarding
  → experiment name: experiment-scm-onboarding
```

For Amplitude group properties, we prefix with `experiment_` and normalize hyphens to underscores to match existing property conventions (`total_arr`, `is_early_adopter`, etc.):

```
Amplitude property: experiment_scm_onboarding = "active" / "control"
```

This transformation happens in two places — the backend `log_experiment_exposure()` and the ETL facts query join. Both should reference each other in comments to keep the naming in sync.

### 2. Exposure Tracking

We revive the patterns from Sentry's old experiment framework (removed Dec 2023 in [`getsentry@8594e8d`](https://github.com/getsentry/getsentry/commit/8594e8d), frontend removed Apr 2025 in [`sentry#90359`](https://github.com/getsentry/sentry/pull/90359)). The old system used PlanOut for randomization (which broke in Python 3.10), but the exposure tracking and Amplitude integration are directly reusable.

### Frontend

The frontend can't log exposure from `organization.features.includes()` — that's just an array lookup with no hook point. The old system solved this with a separate `organization.experiments` dict and a `useExperiment()` hook.

1. **Org serializer** evaluates all `experiment_mode` flags and populates `"experiments"`: `{"experiment-scm-onboarding": "active"}` (or `"control"`). The stub `"experiments": {}` already exists in the serializer.
2. **`useExperiment(experimentName)` hook** — reads from `organization.experiments`, logs exposure via `/_experiment/log_exposure/`. Logs on mount by default (configurable via `logExperimentOnMount: false`). Dedup is handled server-side (see below).
3. **`useFeature(flagName)` hook** (proposed) — a general-purpose hook that replaces `organization.features.includes()` for both regular flags and experiments. Returns a boolean. If the flag is also in `organization.experiments`, it automatically logs exposure. This lets teams migrate feature checks to a function call incrementally, and experiment exposure logging comes for free without needing experiment-specific code everywhere. _(Feasibility TBD with frontend team — may be too large a migration to justify for v1.)_
4. **`organization.features.includes()` still works** for gating — the flag is in both `features` and `experiments`. But for experiment-gated UI, prefer `useExperiment()` or `useFeature()` to get exposure logging.

### Backend

1. **`log_experiment_exposure(experiment_name, org, assignment)`** — fires on exposure:
   - `analytics.record("experiment.exposure", ...)` — lands in BigQuery via PubSub
   - Real-time `group_identify` to Amplitude with `$set` (partial merge, doesn't touch other properties)
   - **Deduped via Redis**: key `exp:exposure:{org_id}:{experiment_name}` with 24h TTL. If the key exists, skip both the analytics event and `group_identify` call. This covers all callers — org serializer, `/_experiment/log_exposure/`, and `features.has()`. The TTL means each org re-fires once per day, which keeps Amplitude fresh and handles silent failures without generating excessive events.
2. **`/_experiment/log_exposure/` endpoint** — receives frontend exposure calls, invokes `log_experiment_exposure()`.
3. **Auto-exposure on `features.has()`** — when backend code checks an experiment flag, exposure is logged automatically.

**Both treatment and control orgs get the `group_identify` call.** The org serializer evaluates experiment flags on every authenticated request, so any org that loads the app gets their Amplitude group property set on first page load. This means Amplitude has full visibility into both groups with no batch dependency.

**Note on exposure semantics:** "Exposure" in this system means "the org was active while the experiment was running" — i.e., any org that loads the app gets labeled, not just orgs that encountered experiment-gated UI. The `useExperiment()` hook provides a more precise signal for frontend-specific exposure if needed, but for analysis purposes the serializer-level labeling is the primary mechanism.

### 3. Analysis

### Amplitude (primary)

Real-time `group_identify` sets experiment properties as org group properties on first page load. Analysts segment any chart by `experiment_scm_onboarding = active` vs `control` using native segmentation.

**Temporal behavior:** Amplitude snapshots group properties onto events at ingestion time ([docs](https://amplitude.com/docs/data/user-properties-and-events)). Once the property is set, all subsequent events carry the label permanently. Events ingested before the property was set won't have it — this is why real-time `group_identify` on first page load matters. When the experiment ends, historical events retain the property for analysis.

### BigQuery (via exposure events)

Exposure events land in `events_denormalized` via the existing `analytics.record()` → PubSub pipeline. The `daily_organizations` facts table can join against the most recent exposure event per org to get the current assignment (handles the edge case where rollout changes cause an org to switch cohorts):

```sql
LEFT JOIN (
  SELECT organization_id, experiment_name, assignment,
    ROW_NUMBER() OVER (PARTITION BY organization_id, experiment_name
                       ORDER BY timestamp DESC) as rn
  FROM events_denormalized
  WHERE event_type = 'experiment.exposure'
) exp ON exp.organization_id = o.organization_id AND exp.rn = 1
```

**Limitation:** Both Amplitude and BigQuery reflect "last known state" rather than "current ground truth." If an experiment is deleted, the last exposure event / group property persists. For v1 this is acceptable — analysts stop querying ended experiments. A future ETL cleanup job can `$unset` stale Amplitude properties if needed.

### 4. Sentry SDK (debugging)

Attach experiment assignments to Sentry error events:

```python
# In sentry/utils/flag.py
def record_experiment_assignment(name: str, variant: str) -> None:
    sentry_sdk.feature_flags.add_feature_flag(f"experiment.{name}", variant)
```

---

## Existing Infrastructure

| Component                                                                  | How it's used                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Flagpole** (`src/flagpole/`)                                             | Deterministic bucketing via `SHA1(org_id) % 100`, segment conditions, YAML config via options-automator |
| **Org serializer** (`src/sentry/api/serializers/models/organization.py`)   | Already has `"experiments": {}` stub from old system                                                    |
| **`analytics.record()`** → PubSub → BigQuery                               | Exposure events land in `events_denormalized` automatically                                             |
| **Amplitude JS SDK** (`@amplitude/analytics-browser`)                      | Frontend events go directly to Amplitude in real-time                                                   |
| **`amplitude-analytics` DAG** (daily 4 AM UTC)                             | Backend `analytics.record()` events batch-pushed to Amplitude                                           |
| **`amplitude-group-props` DAG** (daily 6:45 AM UTC)                        | Syncs org group properties to Amplitude — available as optional fallback                                |
| **`daily_organizations` facts table** (`etl/workspace/dags/sql/facts_v2/`) | Daily org snapshots in BigQuery — can join exposure events                                              |
| **`group_identify` API** (`etl/etl/hooks/amplitude.py`)                    | Partial merge via `$set` — sets only specified properties, leaves others untouched                      |

---

## Implementation Plan

1. **Flagpole**: Add `experiment_mode` field to `Feature` dataclass, JSON schema, and `from_feature_dictionary()`. No behavior change for flags without it.
2. **Org serializer**: Populate `"experiments"` dict by evaluating all `experiment_mode` flags for the org. Map `True` → `"active"`, `False` → `"control"`.
3. **Exposure logging backend** (`getsentry/experiments/exposure.py`): `log_experiment_exposure()` — `analytics.record()` + real-time `group_identify` to Amplitude (both treatment and control, deduped).
4. **`/_experiment/log_exposure/` endpoint** (`getsentry/web/experiment.py`): Receives frontend exposure calls.
5. **Frontend `useExperiment()` hook** (`static/gsApp/hooks/useExperiment.tsx`): Reads from `organization.experiments`, logs exposure via endpoint. localStorage dedup.
6. **Backend auto-exposure**: When `features.has()` is called for an experiment flag, log exposure automatically.
7. **Sentry SDK**: `record_experiment_assignment()` in `sentry/utils/flag.py`.

---

## Prior Art (removed, for reference)

| Commit / PR                                                                                       | What was removed                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`getsentry/getsentry@8594e8d`](https://github.com/getsentry/getsentry/commit/8594e8d) (Dec 2023) | Backend: `experiments/base.py` (PlanOut + Amplitude `group_identify`), `experiments/config.py`, `web/experiment.py` (`log_exposure` endpoint)                |
| [`sentry/sentry#90359`](https://github.com/getsentry/sentry/pull/90359) (Apr 2025)                | Frontend: `experimentConfig.tsx`, `useExperiment.tsx`, `logExperiment.tsx`, `withExperiment.tsx`, `types/experiments.tsx`. Backend: `experiments/manager.py` |
| [`sentry/sentry#90383`](https://github.com/getsentry/sentry/pull/90383) (Apr 2025)                | Backend cleanup: removed `ExperimentManager`, cleared `"experiments"` dict in org/user serializers                                                           |

## Verification Plan

1. **Unit tests**: `experiment_mode` parsing in flagpole, org serializer includes experiments for both treatment and control, exposure dedup logic
2. **Integration test**: Define experiment flag with `experiment_mode: simple` → verify org serializer returns correct assignment → verify `useExperiment()` logs exposure → verify `group_identify` call fires
3. **Manual**: Create experiment flag in options-automator, verify Amplitude group property appears for both treatment and control orgs, verify segmentation works

## Build vs Buy

I evaluated four third-party platforms (Statsig, GrowthBook, Optimizely, SwitchFeat). The key constraint is that flagpole stays as the assignment system. Any third party would only handle analysis/dashboards.

|                                  | Statsig                | GrowthBook                  | Optimizely                          | SwitchFeat |
| -------------------------------- | ---------------------- | --------------------------- | ----------------------------------- | ---------- |
| Push data via API (no warehouse) | Yes                    | Cloud only                  | Yes                                 | No         |
| External assignment support      | First-class            | Supported                   | Supported                           | No         |
| Self-hostable                    | No                     | Yes (needs warehouse)       | No                                  | Yes        |
| API simplicity                   | Simple (flat JSON)     | Simple (flat JSON)          | Complex (nested, need internal IDs) | N/A        |
| Pricing                          | Free tier + usage      | Free + $40/user/mo          | ~$36K-180K+/yr                      | Free       |
| Stats                            | CUPED, sequential, SRM | CUPED, sequential, Bayesian | Sequential, FDR control             | None       |

**SwitchFeat** is not suitable — solo-developer prototype, no experiment support, appears abandoned.
**Optimizely** works but has more friction and cost than Statsig.
**Statsig** is the best fit if we go third-party — first-class support for external assignment + push API.
**GrowthBook** is OSS but analysis is SQL-based (needs warehouse connection).

**Note on "existing Statsig integration":** The `StatsigProvider` in `sentry/flags/providers.py` is a customer-facing product feature (webhook audit log receiver). It's irrelevant to internal experimentation — no Statsig SDK is installed.

**Recommendation: Build on flagpole.** Flagpole already handles assignment. We can pipe data to Statsig later once we have experiment data flowing — starting with a third party doesn't save us from building the exposure tracking layer. Amplitude (which we already use) handles analysis for v1.
