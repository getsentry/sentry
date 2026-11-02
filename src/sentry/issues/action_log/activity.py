from collections.abc import Mapping

from django.db import router, transaction

from sentry.issues.action_log.types import GroupActionLogPayload, GroupActionType
from sentry.issues.derived.processing import invalidate_group_derived_data
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.types.activity import ActivityType
from sentry.utils.action_log.activity_translator import (
    ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE,
    activity_action_idempotency_key,
)

_MUTABLE_ACTIVITY_TYPES: Mapping[int, ActivityType] = {
    GroupActionType.SET_RESOLVED_IN_RELEASE: ActivityType.SET_RESOLVED_IN_RELEASE,
    GroupActionType.REPROCESS: ActivityType.REPROCESS,
}


def refresh_activity_payload(payload: GroupActionLogPayload) -> GroupActionLogPayload:
    """Read the two mutable Activity fields when a delayed mirror is delivered.

    Called inside the outbox transaction. Locking Activity coordinates with the
    mutation sites: either they update an existing mirror, or we insert its latest
    state. All other event data, including actor and source, stays in the payload.
    """
    activity_type = _MUTABLE_ACTIVITY_TYPES.get(payload["type"])
    key = payload.get("idempotency_key", "")
    prefix, _, activity_id = key.partition(":")
    if activity_type is None or prefix != "activity" or not activity_id.isdecimal():
        return payload

    activity = (
        Activity.objects.select_for_update()
        .filter(id=int(activity_id), project_id=payload["project_id"], type=activity_type.value)
        .first()
    )
    if activity is None or activity.group_id is None:
        return payload

    payload = {**payload, "group_id": activity.group_id}
    if activity_type == ActivityType.SET_RESOLVED_IN_RELEASE:
        payload["data"] = {
            **payload["data"],
            "version": (activity.data or {}).get("version"),
        }
    return payload


def sync_activity_log_entry(activity: Activity, *, previous_group_id: int | None = None) -> None:
    """Repair a release-resolution or reprocessing mirror after Activity changes.

    The caller must hold a row lock on Activity through the mutation and this call,
    matching refresh_activity_payload's lock. Missing mirrors are left to the
    outbox/backfill; this must not invent attribution or duplicate an event.
    """
    assert activity.group_id is not None
    action_type = ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE[activity.type].get_type()
    assert action_type in _MUTABLE_ACTIVITY_TYPES
    group_id = previous_group_id if previous_group_id is not None else activity.group_id
    entry = (
        GroupActionLogEntry.objects.select_for_update()
        .filter(
            group_id=group_id,
            project_id=activity.project_id,
            type=action_type,
            idempotency_key=activity_action_idempotency_key(activity),
        )
        .first()
    )
    if entry is None:
        return

    data = entry.data
    if action_type == GroupActionType.SET_RESOLVED_IN_RELEASE:
        data = {**data, "version": (activity.data or {}).get("version")}
    if entry.group_id == activity.group_id and entry.data == data:
        return

    entry.group_id = activity.group_id
    entry.data = data
    entry.save(update_fields=["group_id", "data", "date_updated"])
    # Preserve event order and attribution, but replay derived data if its cursor
    # has already passed the corrected entry.
    new_group_id = activity.group_id
    transaction.on_commit(
        lambda: invalidate_group_derived_data(new_group_id, cursor=(entry.date_added, entry.id)),
        using=router.db_for_write(GroupActionLogEntry),
    )
