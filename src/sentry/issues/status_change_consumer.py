from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from sentry_sdk.tracing import NoOpSpan, Span, Transaction

from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues.escalating import manage_issue_states
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.groupinbox import (
    GroupInboxReason,
    GroupInboxRemoveAction,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.types.activity import ActivityType
from sentry.types.group import IGNORED_SUBSTATUS_CHOICES, GroupSubStatus
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def update_status(group: Group, status_change: StatusChangeMessageData) -> None:
    new_status = status_change["new_status"]
    new_substatus = status_change["new_substatus"]

    if group.status == new_status and group.substatus == new_substatus:
        return

    log_extra = {
        "project_id": status_change["project_id"],
        "fingerprint": status_change["fingerprint"],
        "new_status": new_status,
        "new_substatus": new_substatus,
    }

    # Validate the provided status and substatus - we only allow setting a substatus for unresolved or ignored groups.
    if new_status in [GroupStatus.UNRESOLVED, GroupStatus.IGNORED]:
        if new_substatus is None:
            logger.error(
                "group.update_status.missing_substatus",
                extra={**log_extra},
            )
            return
    else:
        if new_substatus is not None:
            logger.error(
                "group.update_status.unexpected_substatus",
                extra={**log_extra},
            )
            return

    if new_status == GroupStatus.RESOLVED:
        Group.objects.update_group_status(
            groups=[group],
            status=new_status,
            substatus=new_substatus,
            activity_type=ActivityType.SET_RESOLVED,
        )
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED)
        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

    elif new_status == GroupStatus.IGNORED:
        # The IGNORED status supports 3 substatuses. For UNTIL_ESCALATING and
        # UNTIL_CONDITION_MET, we expect the caller to monitor the conditions/escalating
        # logic and call the API with the new status when the conditions change.
        if new_substatus not in IGNORED_SUBSTATUS_CHOICES:
            logger.error(
                "group.update_status.invalid_substatus",
                extra={**log_extra},
            )
            return

        Group.objects.update_group_status(
            groups=[group],
            status=new_status,
            substatus=new_substatus,
            activity_type=ActivityType.SET_IGNORED,
        )
        remove_group_from_inbox(group, action=GroupInboxRemoveAction.IGNORED)
        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )
    elif new_status == GroupStatus.UNRESOLVED and new_substatus == GroupSubStatus.ESCALATING:
        # Update the group status, priority, and add the group to the inbox
        manage_issue_states(group=group, group_inbox_reason=GroupInboxReason.ESCALATING)
    elif new_status == GroupStatus.UNRESOLVED:
        activity_type = None
        if new_substatus == GroupSubStatus.REGRESSED:
            activity_type = ActivityType.SET_REGRESSION
            group_inbox_reason = GroupInboxReason.REGRESSION

        elif new_substatus == GroupSubStatus.ONGOING:
            group_inbox_reason = GroupInboxReason.ONGOING
            if group.substatus == GroupSubStatus.ESCALATING:
                # If the group was previously escalating, update the priority via AUTO_SET_ONGOING
                activity_type = ActivityType.AUTO_SET_ONGOING
            else:
                activity_type = ActivityType.SET_UNRESOLVED

        # We don't support setting the UNRESOLVED status with substatus NEW as it
        # is automatically set on creation. All other issues should be set to ONGOING.
        if activity_type is None:
            logger.error(
                "group.update_status.invalid_substatus",
                extra={**log_extra},
            )
            return

        Group.objects.update_group_status(
            groups=[group],
            status=new_status,
            substatus=new_substatus,
            activity_type=activity_type,
            from_substatus=group.substatus,
        )
        add_group_to_inbox(group, group_inbox_reason)
        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )
    else:
        logger.error(
            "group.update_status.unsupported_status",
            extra={**log_extra},
        )
        raise NotImplementedError(
            f"Unsupported status: {status_change['new_status']} {status_change['new_substatus']}"
        )


def bulk_get_groups_from_fingerprints(
    project_fingerprint_pairs: Iterable[tuple[int, Sequence[str]]]
) -> dict[tuple[int, str], Group]:
    """
    Returns a map of (project, fingerprint) to the group.

    Note that fingerprints for issue platform are expected to be
    hashed prior to calling this function.
    """
    fingerprints_by_project: dict[int, list[str]] = defaultdict(list)
    for project_id, fingerprints in project_fingerprint_pairs:
        fingerprints_by_project[project_id].append(fingerprints[0])

    query = GroupHash.objects.none()
    for project_id, fingerprints in fingerprints_by_project.items():
        query = query.union(
            GroupHash.objects.filter(
                project=project_id,
                hash__in=fingerprints,
            ).select_related("group")
        )

    result = {
        (grouphash.project_id, grouphash.hash): grouphash.group
        for grouphash in query
        if grouphash.group is not None
    }

    found_fingerprints = set(result.keys())
    fingerprints_set = {
        (project_id, fingerprint[0]) for project_id, fingerprint in project_fingerprint_pairs
    }
    for project_id, fingerprint in fingerprints_set - found_fingerprints:
        metrics.incr("occurrence_ingest.grouphash.not_found")

    return result


def _get_status_change_kwargs(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """
    Processes the incoming message payload into a format we can use.
    """
    from sentry.issues.ingest import hash_fingerprint_parts

    data = {
        "fingerprint": hash_fingerprint_parts(payload["fingerprint"]),
        "project_id": payload["project_id"],
        "new_status": payload["new_status"],
        "new_substatus": payload.get("new_substatus", None),
    }

    return {"status_change": data}


def process_status_change_message(
    message: Mapping[str, Any], txn: Transaction | NoOpSpan | Span
) -> Group | None:
    with metrics.timer("occurrence_consumer._process_message.status_change._get_kwargs"):
        kwargs = _get_status_change_kwargs(message)
    status_change_data = kwargs["status_change"]

    metrics.incr(
        "occurrence_ingest.status_change.messages",
        sample_rate=1.0,
        tags={"new_status": status_change_data["new_status"]},
    )
    txn.set_tag("new_status", status_change_data["new_status"])

    project = Project.objects.get_from_cache(id=status_change_data["project_id"])
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    txn.set_tag("organization_id", organization.id)
    txn.set_tag("organization_slug", organization.slug)
    txn.set_tag("project_id", project.id)
    txn.set_tag("project_slug", project.slug)

    with metrics.timer("occurrence_consumer._process_message.status_change.get_group"):
        fingerprint = status_change_data["fingerprint"]
        groups_by_fingerprints = bulk_get_groups_from_fingerprints([(project.id, fingerprint)])
        group = groups_by_fingerprints.get((project.id, fingerprint[0]), None)
        if not group:
            logger.info(
                "status_change.dropped_group_not_found",
                extra={
                    "fingerprint": fingerprint,
                    "new_status": status_change_data["new_status"],
                    "project_id": status_change_data["project_id"],
                },
            )
            metrics.incr(
                "occurrence_ingest.status_change.dropped_group_not_found",
                sample_rate=1.0,
            )
            return None
        txn.set_tag("group_id", group.id)

    with metrics.timer(
        "occurrence_consumer._process_message.status_change.update_group_status",
        tags={"occurrence_type": group.issue_type.type_id},
    ):
        update_status(group, status_change_data)

    return group
