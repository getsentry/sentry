# Activity mutations and the append-only action log

`GroupActionLogEntry` (GALE) reproduces the records `Activity` keeps of things that happen to
an issue, but the two have different contracts: GALE is append-only, and `Activity` rows are
mutated in place in several code paths.

This document enumerates those paths.

## Why a mutation is invisible to GALE

GALE rows are published from `Activity.objects.create()` and `Activity.objects.bulk_create()`
only — see `src/sentry/models/activity.py:136` and `:163`. `Activity.save()`
(`src/sentry/models/activity.py:235`) does **not** publish, and neither does the queryset
`update()` helper in `src/sentry/db/models/query.py:79`, which issues a direct `UPDATE` and
never calls `save()`.

Each entry is keyed by `idempotency_key = f"activity:{activity.id}"`
(`src/sentry/utils/action_log/activity_translator.py:208`), unique per
`(group_id, idempotency_key)` (`src/sentry/issues/models/groupactionlogentry.py:98`).

So a GALE row is a snapshot of the `Activity` as it existed at creation. Every mutation after
that point diverges the two records unless something explicitly appends a corresponding action.

## Case 1 — `data` rewritten in place

The GALE row keeps the values captured at creation. All four activity types below are
translated (`activity_translator.py:74-86`), so a GALE row exists in each case and goes stale.

### 1a. Regression backfills the resolved-in-release version

`src/sentry/event_manager.py:1786-1807`

When a group resolved in an _upcoming_ release regresses, the most recent
`SET_RESOLVED_IN_RELEASE` activity has its empty `data["version"]` replaced with the release
that shipped. The merge is deliberate — `current_release_version` must survive for semver
releases.

`SetResolvedInReleaseAction.version` stays `""` on the GALE side.

### 1b. Expired resolutions get their version filled in

`src/sentry/tasks/clear_expired_resolutions.py:51-60`

The same field, written by the task that runs when a release is created. Note this one
replaces `data` wholesale rather than merging, so it drops `current_release_version` where
1a preserves it — the two paths disagree with each other, independently of GALE.

### 1c. Seer stamps a run pointer onto the triggering activity

`src/sentry/seer/smart_assignment/trigger.py:178-193` (`_stamp_activity`)

Writes `data["seer_smart_assignment"]` — run id, uuid, and trigger — onto the activity that
kicked off a Seer run, for traceability. The docstring notes `SeerAgentRun` is the queryable
mirror, so this may not need to be represented in GALE at all; worth confirming rather than
assuming.

### 1d. External comment id written back onto a note

`src/sentry/integrations/tasks/create_comment.py:61-62`

After an external issue comment is created, `data["external_id"]` is set on the `NOTE`
activity. `update_comment.py:45` reads the note but does not mutate it.

## Case 2 — note edit and delete (already modeled)

These two are the template the other cases should probably follow: the mutation is recorded by
_appending_ a new action that references the original entry's id.

- **Edit** — `src/sentry/issues/endpoints/group_notes_details.py:173-174` mutates
  `note.data` and saves, then publishes `CommentEditAction(comment_id=<original GALE id>)`.
- **Delete** — `group_notes_details.py:95` deletes the `Activity` row, then publishes
  `CommentDeleteAction(comment_id=<original GALE id>)`.

Both look up the original GALE row by `activity_action_idempotency_key(note)` and, when
`projects:issue-action-log-activity` is on, treat a missing entry as a 404 rather than
mutating the `Activity` alone.

## Case 3 — `group_id` reassignment

### 3a. Reprocessing moves the activity to the new group

`src/sentry/tasks/reprocessing2.py:263-268`

The `REPROCESS` activity is re-parented to the new group by assigning `activity.group_id` from
`data["newGroupId"]` and calling `save()`. The GALE row stays on the old group.

Because uniqueness is scoped to `(group_id, idempotency_key)`, nothing prevents an entry with
the same `activity:<id>` key existing under both groups.

### 3b. Merge re-parents both (no divergence)

`src/sentry/tasks/merge.py:176-188`, via `merge_objects` at `:308`

`Activity` and `GroupActionLogEntry` are both in the merge model list, so both are re-parented,
and GALE additionally records `original_group_id`. Listed here only because it is a sanctioned
mutation of an append-only table — it is not a divergence.

## Case 4 — deletion by cascade (no divergence)

`src/sentry/deletions/defaults/group.py:83-84`

`Activity` and `GroupActionLogEntry` are both in `DIRECT_GROUP_RELATED_MODELS`, so group
deletion removes both. Symmetric.

## Summary

| Case | Site                              | Mutates                         | Represented in GALE         |
| ---- | --------------------------------- | ------------------------------- | --------------------------- |
| 1a   | `event_manager.py:1802`           | `data["version"]`               | No                          |
| 1b   | `clear_expired_resolutions.py:60` | `data` (replaced)               | No                          |
| 1c   | `smart_assignment/trigger.py:193` | `data["seer_smart_assignment"]` | No                          |
| 1d   | `create_comment.py:62`            | `data["external_id"]`           | No                          |
| 2    | `group_notes_details.py:174`      | `data`                          | Yes — `CommentEditAction`   |
| 2    | `group_notes_details.py:95`       | row deleted                     | Yes — `CommentDeleteAction` |
| 3a   | `reprocessing2.py:268`            | `group_id`                      | No                          |
| 3b   | `merge.py:187`                    | `group_id`                      | Yes — both re-parented      |
| 4    | `deletions/defaults/group.py:83`  | row deleted                     | Yes — both deleted          |

Cases 1a–1d and 3a are the open ones.

## Finding new cases

Neither `Activity.save()` nor the `update()` helper publishes, so a new mutation site will not
announce itself. To re-derive this list:

```bash
rg -n --type py '\b\w*(activity|note)\.(save|update|delete)\(' src/ -g '!**/migrations/**'
rg -n --type py -U 'Activity\.objects\.filter\([^)]*\)\s*\.(update|delete)\(' src/
```
