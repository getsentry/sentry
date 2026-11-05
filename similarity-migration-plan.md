# Seer similarity migration: per-PR handoff briefs

Goal: every SaaS project uses Seer embeddings similarity, controlled by one option that covers
every project in a region, `similarity.seer_grouping.all_projects`: on for SaaS, off for
self-hosted. The legacy Redis MinHash index is then no longer read or written in SaaS, so infra
can retire the `rc-similarity` cluster in DE. Self-hosted keeps the legacy code path.

Each PR section below is a self-contained brief. Paste one section, plus the "Shared context"
block, to the agent doing that PR.

## Shared context (paste with every brief)

- Repos on this machine: sentry `~/code/sentry`, getsentry `~/code/getsentry`,
  options automator `~/code/sentry-options-automator` (default branch is `main`, not `master`).
- Grouping itself is hash-based for every project and is not changed by any of this. The
  legacy Redis index never groups anything; it only feeds the Similar Issues tab. Seer adds one
  step at ingest: for an event with a brand-new hash, Sentry asks Seer for a similar existing
  issue before opening a new one. Seer can only put events into existing issues, never split
  them.
- Before PR 1, the runtime switch is the per-project option `sentry:similarity_backfill_completed`.
  Truthy means the project uses Seer; missing means it uses the legacy Redis index.
  PR 1 adds the all-projects option, and the helper treats either one as "uses Seer".
- `similarity.new_project_seer_grouping.enabled` is read only at project creation, to decide
  whether to stamp the per-project option on a new project. It is on in every SaaS region
  (automator `options/default/issues.yaml`, no region override).
- Roughly 7k DE and 11.6k US projects with events were created without the per-project option
  and are stuck on legacy. getsentry/sentry#129632 (merged) fixed the creation leak but not
  those projects. They move to Seer when the all-projects option turns on; there is no backfill
  job.
  Their existing issues are never indexed in Seer, because Seer is only called for new hashes.
  That costs at most one extra issue per still-active old issue, and old issues never show up
  in the Similar Issues tab. Both were accepted as fine.
- Load check, 7-day averages from Datadog on 2026-11-05: new-hash events from stuck projects
  are about 2% of Seer ingest calls (US 0.65/s against 34.4/s, DE 0.15/s against 6.8/s). The
  per-region Seer ingest limit is 200/s (`seer.similarity.global-rate-limit`) and was not hit in
  the last day. This is why there is no percentage ramp.
- Option values are set per region. The automator's `options/default/` files apply to every
  SaaS region, and a region's `options/regions/<region>/` file overrides them. Self-hosted never
  sees the automator and keeps the value in code, which for the all-projects option is off.
- Deploy-order rule: sentry and getsentry deploy independently, and the automator rejects values
  for options sentry has not registered. "Gate" in each brief means the previous PR must be
  deployed to every region, not merely merged.
- Never put customer org slugs, project ids tied to a customer, or similar identifiers in code,
  tests, commit messages or PR bodies.
- Run only the listed test files, never bare `pytest`. Python commands use `.venv/bin/...`; in a
  worktree without an editable install, prefix `PYTHONPATH=src`. Finish with
  `.venv/bin/prek run -q` and mypy on changed source and test files.

## Order and gates

| PR  | Repo      | Change                                                              | Gate                                    |
| --- | --------- | ------------------------------------------------------------------- | --------------------------------------- |
| 1   | sentry    | Shared helper and the all-projects option (getsentry/sentry#130152) | none; no behavior change at the default |
| 2   | getsentry | `SimilarityEmbeddingsAPIFeatureHandler` calls the helper            | PR 1 deployed                           |
| 3   | automator | All-projects option on in DE                                        | PR 2 deployed                           |
| 4   | automator | All-projects option on in the default file, for all of SaaS         | DE stable for a few days                |
| 5   | getsentry | Drop DE `rc-similarity` cluster wiring                              | PR 3 deployed, infra date agreed        |
| 6   | sentry    | Helper reads only the all-projects option; delete per-project code  | PR 4 deployed                           |
| 7   | automator | Remove the new-project option and the DE override                   | PR 6 deployed everywhere                |
| 8   | sentry    | Unregister the new-project option                                   | PR 7 merged and automator `main` green  |

The hard ordering rule: the all-projects option must not turn on anywhere before PR 2 is
deployed.
Until then, a moved project's frontend calls the legacy endpoint, which returns an empty list
for Seer projects, and the Similar Issues tab goes blank.

---

## PR 1 (sentry): shared helper and all-projects option

Open as draft getsentry/sentry#130152 on branch `claude/similar-issues-api-ff583c`.
Title: `ref(grouping): Route Seer similarity checks through one helper`.

### What it does

- Registers `similarity.seer_grouping.all_projects` (`Bool`, default `False`, automator-modifiable)
  in `src/sentry/options/defaults.py`.
- Adds `project_uses_seer_similarity(project)` and the batch form
  `projects_using_seer_similarity(projects)` to `src/sentry/seer/similarity/utils.py`. True when
  the all-projects option is on or the project has the per-project option. The batch form does
  one `ProjectOption.objects.get_value_bulk` query, and none when the all-projects option is on.
- Routes every runtime read through the helper: ingest
  (`_project_has_similarity_grouping_enabled`, which keeps its metric), post-process indexing,
  the legacy similar-issues endpoint, merge, both unmerge sites, reprocessing, group deletion,
  project deletion, and the Seer record cleanup task. The import in `post_process.py` is inside
  the function because that module loads while Django's app registry is still populating.
- Leaves creation-time code alone (`project_is_seer_eligible`,
  `set_default_project_similarity_grouping` and their callers); PR 6 deletes it.

### Tests

The ingest gate in `tests/sentry/grouping/seer_similarity/test_seer_eligibility.py`, the
post-process indexing skip in `tests/sentry/tasks/test_post_process.py`, and a batch-equals-single
check in `tests/sentry/seer/similarity/test_utils.py`. Other files that touch the option and must
still pass: `tests/sentry/grouping/seer_similarity/test_seer.py`,
`tests/sentry/tasks/seer/test_delete_seer_grouping_records.py`,
`tests/sentry/core/endpoints/test_project_details.py`, `tests/sentry/deletions/test_group.py`,
`tests/sentry/deletions/test_project.py`, `tests/snuba/tasks/test_unmerge.py`.

### Remaining

Local test run, then mark ready for review.

---

## PR 2 (getsentry): feature handler uses the helper

Branch from getsentry `master`. Suggested title: `ref(similarity): Derive similarity-embeddings from the shared helper`.

### Why

The frontend picks the embeddings endpoint or the legacy endpoint from the project feature
`projects:similarity-embeddings`. getsentry computes it in `getsentry/features.py`
`SimilarityEmbeddingsAPIFeatureHandler` by reading the raw project option. Once the
all-projects option is on, a stuck project ingests to Seer but this handler still says false, so the tab
calls the legacy endpoint and shows nothing.

### Change

- `has`: return `not options.get("seer.similarity-embeddings-killswitch.enabled") and
  project_uses_seer_similarity(feature.project)`.
- `has_for_batch`: keep the killswitch short-circuit; otherwise return
  `projects_using_seer_similarity(list(batch.objects))`.
- Import both from `sentry.seer.similarity.utils`. Drop the direct `ProjectOption` bulk read.

### Tests

`tests/getsentry/test_features.py::TestSimilarityEmbeddingsAPIFeatureHandler`. Add cases:
all-projects option on with no project option gives True for `has` and `has_for_batch`; project option alone
still gives True; the killswitch still wins over both.

### Gate and acceptance

- Merge only after PR 1 is deployed to every region. getsentry imports the helper at module
  load, so a getsentry build running against a sentry without it fails at boot.
- No behavior change at default option values.

---

## PR 3 (automator): all-projects option on in DE

Repo `sentry-options-automator`, branch from `main`. Add
`similarity.seer_grouping.all_projects: True` under `options:` in `options/regions/de/issues.yaml`.
DE goes first because infra is waiting on its Redis cluster, and it is a smaller canary than US.

### Before merging

- Confirm PR 2 is deployed everywhere. Automator CI rejects an unregistered option, so PR 1
  must be out too.

### Watch for a few days

- `sentry.grouping.similarity.did_call_seer` by `blocker` in DE: no `global-rate-limit` and no
  circuit-breaker blocks (`seer.similarity.circuit-breaker-config`).
- `sentry.grouping.similarity.event_project_backfill_status{sentry_region:de}`: the
  `backfilled:false` series should drop to zero. The tag now reports the helper's answer, so
  zero means every DE project with new hashes is on Seer.
- Seer grouping request rate, latency and error rate.
- Legacy writes to the DE Redis cluster should stop. The Sentry-side metric
  `sentry.similarity.record.count` cannot be split by region, so ask infra to confirm from the
  cluster's own command metrics, and tell Vinayak Rao it is idle.
- Rollback: set the value to `False` in a new PR, or add the `Trigger: Revert` label. Moved
  projects go back to the legacy path; nothing else needs undoing.

---

## PR 4 (automator): all-projects option on for all of SaaS

Branch from `main`. Add `similarity.seer_grouping.all_projects: True` to
`options/default/issues.yaml`. This covers US and the single-tenant regions. In the 7-day check,
only US and a trickle in one single-tenant region had stuck projects; s4s2 and the other
single-tenant regions had none. Gate: DE
stable for a few days after PR 3. Watch the same signals as PR 3 for US, then confirm the
`backfilled:false` series is zero in every region.

---

## PR 5 (getsentry): drop DE's rc-similarity cluster wiring

Branch from getsentry `master`. In `getsentry/conf/settings/cellsilo.py`, the DE block defines
both `similarity` and `rc-similarity` pointing at `rc-similarity{consul_suffix}` hosts. US
already points `similarity` at a memorystore instance.

- First check whether `sentry/similarity/__init__.py` and `sentry/similarity/backends/redis.py`
  resolve the cluster lazily or at import. If at import, repoint DE's `similarity` alias at an
  existing cluster the same way US does rather than deleting it, so the process still boots.
  Delete the `rc-similarity` entry either way.
- `SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER = "similarity"` stays.
- Gate: PR 3 deployed and infra has confirmed the cluster is idle. Coordinate the merge with
  infra's decommission date. This PR does not depend on PR 4.

---

## PR 6 (sentry): collapse to the all-projects option

Branch from `master`. Suggested title: `ref(grouping): Make Seer similarity a single option`.

### Why

The all-projects option is on for all of SaaS. The per-project option and the creation-time
stamping are dead weight.

### Change

- `project_uses_seer_similarity` and `projects_using_seer_similarity` return
  `options.get("similarity.seer_grouping.all_projects")` and nothing else. The batch form no longer
  queries the database. Resolve the TODO in the helper's docstring.
- Delete `project_is_seer_eligible` and `set_default_project_similarity_grouping` from
  `src/sentry/seer/similarity/utils.py`, and their calls in
  `src/sentry/core/endpoints/team_projects.py` `apply_default_project_settings` and
  `src/sentry/projects/services/project/impl.py` `create_project_for_organization`.
- Delete `src/sentry/tasks/embeddings_grouping/constants.py` if `PROJECT_BACKFILL_COMPLETED` is
  its only content; otherwise just the constant.
- Remove the `sentry:similarity_backfill_completed` registration from
  `src/sentry/projectoptions/defaults.py` and its entry in the key list in
  `src/sentry/models/options/project_option.py`. Check what that list gates first.
- Stop reading `similarity.new_project_seer_grouping.enabled`. Keep it registered; PR 8
  unregisters it.
- `grep -rn "similarity_backfill_completed\|new_project_seer_grouping" src/` must return only
  the option registration in `options/defaults.py`.

### Tests

Switch the test files listed under PR 1, plus `tests/sentry/api/helpers/test_group_index.py`,
`tests/sentry/deletions/test_organization.py`, `tests/sentry/event_manager/grouping/test_seer_grouping.py`
and `tests/sentry/runner/commands/test_cleanup.py`, from setting the project option to
`override_options({"similarity.seer_grouping.all_projects": True})`. Remove the creation-time tests in
`tests/sentry/core/endpoints/test_team_projects.py` and `tests/sentry/hybridcloud/test_project.py`
that assert the option gets stamped. getsentry's
`tests/getsentry/test_features.py::TestSimilarityEmbeddingsAPIFeatureHandler` sets the project
option in some cases; those need a companion getsentry test-only PR that switches them to the
all-projects option. The handler code needs no change.

### Acceptance

- Self-hosted, with the option off, behaves exactly as before: legacy path, no Seer calls.
- SaaS, with the option on: every project uses Seer, and no project-option reads remain.

---

## PR 7 (automator): remove the retired values

Branch from `main`. Gate: PR 6 deployed to every region. Remove:

- `similarity.new_project_seer_grouping.enabled` from `options/default/issues.yaml`; check no
  region file sets it.
- The DE override from PR 3, which is redundant with the default file.

Leave `sentry.similarity.indexing.enabled` alone, because self-hosted still uses it. Confirm
`#feed-options-automator` is green before PR 8.

---

## PR 8 (sentry): unregister the retired option

Branch from `master`. Gate: PR 7 merged and the automator `main` drift job green. Delete the
`register(...)` block for `similarity.new_project_seer_grouping.enabled` from
`src/sentry/options/defaults.py`. Nothing reads it after PR 6. Follow the
`remove-option-or-flag` skill's step 3 checklist.

---

## Out of scope here

- The agent-facing similar-issues endpoint (typed schema, Seer Code Mode admit, MCP tool) is a
  separate track and does not depend on any PR above.
- `projects:similarity-view` must stay on for SaaS: the Similar Issues tab only renders when it
  is on, even for embeddings. The legacy `/similar/` endpoint and `src/sentry/similarity/` stay
  for self-hosted.
