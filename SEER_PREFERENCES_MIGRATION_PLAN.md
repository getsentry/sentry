# Seer Project Preferences Migration — Rollout & Deploy Plan

Migrating `seer_project_preference` from Seer's Postgres to Sentry's Postgres. The feature flags `organizations:seer-project-settings-dual-write` (DW) and `organizations:seer-project-settings-read-from-sentry` (RFS) gate the Sentry-DB code paths; this plan retires both, deletes the Seer-side endpoints, and drops the Seer table.

## Pre-requisites

- Both flags rolled out to **100% of eligible orgs** and stable before Phase 1.
- Backfill complete: every `seer_project_preference` row in Seer has a corresponding `SeerProjectPreference` row in Sentry.
- Verify with a spot-check script before starting.

## Ground rules for every step

- Each PR must be safe during a rolling deploy (mixed old/new Sentry webservers, taskworkers, and Seer pods running concurrently).
- Don't remove a callee until all callers are gone **and deployed**. Don't remove a flag branch until the flag is at 100% and stable.
- Between phases, wait for **full production rollout** + (where applicable) **task queue drain** before starting the next.

## Endpoint → client wrapper map

| Seer endpoint (`src/seer/automation/preferences.py`) | Sentry client wrapper                                                  | Retired in phase         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| `get_seer_project_preference`                        | `make_get_project_preference_request` → `get_project_seer_preferences` | 1 (client), 4 (endpoint) |
| `bulk_get_seer_project_preference`                   | `bulk_get_project_seer_preferences`                                    | 1 (client), 4 (endpoint) |
| `set_seer_project_preference`                        | `make_set_project_preference_request` → `set_project_seer_preference`  | 2 (client), 4 (endpoint) |
| `bulk_set_seer_project_preference`                   | `bulk_set_project_seer_preferences`                                    | 2 (client), 4 (endpoint) |
| `remove_repository_from_project_preference`          | `make_remove_repository_request`                                       | 3 (client), 4 (endpoint) |
| `bulk_remove_repositories_from_project_preference`   | `make_bulk_remove_repositories_request`                                | 3 (client), 4 (endpoint) |
| `remove_project_preference_handoffs_for_integration` | `make_remove_handoffs_for_integration_request`                         | 3 (client), 4 (endpoint) |

---

## Phase 1 — Remove read flag (RFS)

Stop all Sentry → Seer read calls. Drop RFS flag.

- **PR 1 (sentry):** Simplify read **helpers** — drop RFS branch; always use `read_preference_from_sentry_db` / `bulk_read_preferences_from_sentry_db`.
  - `src/sentry/seer/autofix/utils.py` (`has_project_connected_repos`)
  - `src/sentry/seer/autofix/autofix.py` (`_resolve_project_preference` read half)
  - `src/sentry/seer/autofix/autofix_agent.py`
  - `src/sentry/seer/autofix/coding_agent.py`
  - `src/sentry/seer/autofix/issue_summary.py` (`get_automation_stopping_point`)
  - `src/sentry/seer/autofix/on_completion_hook.py` (`_get_handoff_config`, `_clear_handoff_preference` read half)
  - `src/sentry/seer/code_review/contributor_seats.py` (`_is_autofix_enabled_for_repo`) — added by [sentry#113369](https://github.com/getsentry/sentry/pull/113369)
  - `src/sentry/tasks/seer/autofix.py`
  - `src/sentry/tasks/seer/context_engine_index.py`
  - `src/sentry/tasks/seer/night_shift/cron.py` — update the caller to invoke `bulk_read_preferences_from_sentry_db` directly (leave the `bulk_read_preferences` wrapper in `utils.py` untouched; it becomes orphaned and is deleted in PR 3).

- **PR 2 (sentry):** Simplify read **endpoints / RPC handlers** — drop RFS branch.
  - `src/sentry/seer/endpoints/project_seer_preferences.py` (GET)
  - `src/sentry/seer/endpoints/organization_autofix_automation_settings.py` (GET list + POST read-before-merge)
  - `src/sentry/seer/endpoints/organization_seer_onboarding_check.py` (`is_autofix_enabled`)
  - `src/sentry/seer/endpoints/seer_rpc.py` (`_trigger_coding_agent_handoff` fallback read, `get_project_preferences`, `bulk_get_project_preferences`)

- **PR 3 (sentry):** Delete orphaned read client wrappers + RPC registry entries.
  - Remove: `get_project_seer_preferences`, `bulk_get_project_seer_preferences`, `make_get_project_preference_request`, `bulk_read_preferences` (wrapper in `seer/autofix/utils.py` — orphaned after PR 1), their Pydantic request/response classes
  - Grep first to confirm zero importers.

- **PR 4 (sentry):** Unregister RFS flag in `src/sentry/features/temporary.py`.

_Deploy full rollout before Phase 2._

---

## Phase 2 — Remove write flag (DW) in Sentry

Stop all Sentry → Seer write calls. Drop DW flag. Cleanup tasks keep their Seer HTTP calls for now (Phase 3 handles them).

- **PR 5 (sentry):** Simplify write **helpers** — drop DW branch; write only to Sentry DB.
  - `src/sentry/seer/similarity/utils.py`
  - `src/sentry/seer/autofix/autofix.py` (`_resolve_project_preference` write-back)
  - `src/sentry/seer/autofix/on_completion_hook.py` (`_clear_handoff_preference` write half)
  - `src/sentry/seer/endpoints/seer_rpc.py:626` (`_trigger_coding_agent_handoff` clear-on-error)

- **PR 6 (sentry):** Simplify write **endpoints** — drop DW branch.
  - `src/sentry/seer/endpoints/project_seer_preferences.py` (POST)
  - `src/sentry/seer/endpoints/organization_autofix_automation_settings.py` (POST)

- **PR 7 (sentry):** In `src/sentry/tasks/seer/cleanup.py`, make the local-delete branch unconditional (drop the DW gate). **Keep** the Seer HTTP call for now.

- **PR 8 (sentry):** Delete orphaned write client wrappers + RPC registry entries.
  - Remove: `set_project_seer_preference`, `bulk_set_project_seer_preferences`, `make_set_project_preference_request`, their Pydantic request/response classes

- **PR 9 (sentry):** Unregister DW flag in `src/sentry/features/temporary.py`.

_Deploy full rollout before Phase 3._

---

## Phase 3 — Retire cleanup tasks (Sentry side)

Inline the three cleanup tasks at their callers and sever their Seer HTTP calls. This removes the last Sentry → Seer preference traffic.

- **PR 10 (sentry):** **Inline + sever Seer call in one shot.**
  - Inline each task body at its 5 call sites as a direct ORM delete inside the existing `transaction.atomic(...)` block (replace `transaction.on_commit(lambda: X.apply_async(...))`):
    - `src/sentry/integrations/services/repository/impl.py:158, 201, 239, 262`
    - `src/sentry/integrations/api/endpoints/organization_repository_details.py:103`
  - Strip the Seer HTTP call from each task body in `src/sentry/tasks/seer/cleanup.py`. Body becomes just the local ORM delete.
  - Delete the now-orphaned client wrappers + request classes:
    - `make_remove_repository_request`
    - `make_bulk_remove_repositories_request`
    - `make_remove_handoffs_for_integration_request`
  - **Keep `src/sentry/tasks/seer/cleanup.py` in place** so in-flight queued messages still have something to execute.

  _Rolling-deploy safety:_ old workers still dispatch + execute old task bodies (which call Seer — fine, endpoints still exist). New workers inline. Queued messages landing on new workers run the stripped-down body — local deletes are idempotent, so double-dispatch is harmless.

  _Deploy full rollout + drain the `seer_tasks` queue fully before PR 11._

- **PR 11 (sentry):** Delete `src/sentry/tasks/seer/cleanup.py`, `tests/sentry/tasks/seer/test_cleanup.py`, and the stale `@patch` lines in `tests/sentry/integrations/services/repository/test_impl.py` and `tests/sentry/integrations/models/deletions/test_organizationintegration.py`. Remove the `seer_tasks` taskworker namespace registration if no other task uses it (grep `seer_tasks` first).

---

## Phase 4 — Remove all Seer preference endpoints

After Phase 3 ships, no Sentry code calls any preference endpoint on Seer. Verify via Seer dashboards/logs: **zero traffic on these routes for ≥24 hours**, then:

- **PR 12 (seer):** Delete all 7 endpoints and their FastAPI route registrations in `src/seer/automation/preferences.py`:
  - `get_seer_project_preference`
  - `bulk_get_seer_project_preference`
  - `set_seer_project_preference`
  - `bulk_set_seer_project_preference`
  - `remove_repository_from_project_preference`
  - `bulk_remove_repositories_from_project_preference`
  - `remove_project_preference_handoffs_for_integration`

  Keep the `DbSeerProjectPreference` model + table for now (Phase 5 drops it).

---

## Phase 5 — Drop the Seer preferences table

**Pre-req:** Phase 4 fully deployed. Zero queries against `seer_project_preference` for ≥1 week.

- **PR 13 (seer):** Alembic migration to drop the `seer_project_preference` table. Delete the `DbSeerProjectPreference` ORM class and the `SeerProjectPreference.from_db_model` / `to_db_model` helpers.

---

## Ordering constraints satisfied

| Constraint                                       | Where                                                    |
| ------------------------------------------------ | -------------------------------------------------------- |
| Read flag before write flag                      | Phase 1 → Phase 2                                        |
| Sentry before Seer                               | PRs 1–11 (sentry) → PR 12 (seer)                         |
| Helpers before endpoints                         | PR 1 → 2; PR 5 → 6                                       |
| Producers stop before consumers deleted (Celery) | PR 10 stops dispatch; PR 11 deletes task def after drain |
| Callers stop before callees deleted (HTTP)       | Phase 3 stops calls; Phase 4 deletes endpoints           |
| Schema dropped last                              | Phase 5                                                  |

## Critical drain / soak points

- **Between PR 10 and PR 11:** `seer_tasks` queue depth must be 0, and all workers on post-PR-10 code.
- **Between Phase 3 and Phase 4:** verify zero traffic on the 7 Seer preference routes for ≥24 h before PR 12.
- **Before Phase 5:** verify zero queries against `seer_project_preference` for ≥1 week.

## Summary

13 PRs across 2 repos, 5 phases:

| Phase                    | Sentry PRs    | Seer PRs |
| ------------------------ | ------------- | -------- |
| 1. RFS removal           | 1, 2, 3, 4    | —        |
| 2. DW removal            | 5, 6, 7, 8, 9 | —        |
| 3. Retire cleanup tasks  | 10, 11        | —        |
| 4. Remove Seer endpoints | —             | 12       |
| 5. Drop table            | —             | 13       |
