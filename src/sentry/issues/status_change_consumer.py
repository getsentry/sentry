from __future__ import annotations

import logging
from typing import Any, Mapping

from sentry_sdk.tracing import NoOpSpan, Transaction

from sentry import features
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
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
    elif new_status == GroupStatus.UNRESOLVED:
        activity_type = None
        if new_substatus == GroupSubStatus.ESCALATING:
            activity_type = ActivityType.SET_ESCALATING
        elif new_substatus == GroupSubStatus.REGRESSED:
            activity_type = ActivityType.SET_REGRESSION
        elif new_substatus == GroupSubStatus.ONGOING:
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
        )
    else:
        logger.error(
            "group.update_status.unsupported_status",
            extra={**log_extra},
        )
        raise NotImplementedError(
            f"Unsupported status: {status_change['new_status']} {status_change['new_substatus']}"
        )


def get_group_from_fingerprint(status_change: StatusChangeMessageData) -> Group | None:
    grouphash = (
        GroupHash.objects.filter(
            project=status_change["project_id"],
            hash=status_change["fingerprint"][0],
        )
        .select_related("group")
        .first()
    )

    if not grouphash:
        logger.error(
            "grouphash.not_found",
            extra={
                "project_id": status_change["project_id"],
                "fingerprint": status_change["fingerprint"],
            },
        )
        return None

    return grouphash.group


def _get_status_change_kwargs(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """
    Processes the incoming message payload into a format we can use.
    """
    from sentry.issues.ingest import process_occurrence_data

    data = {
        "fingerprint": payload["fingerprint"],
        "project_id": payload["project_id"],
        "new_status": payload["new_status"],
        "new_substatus": payload.get("new_substatus", None),
    }

    process_occurrence_data(data)
    return {"status_change": data}


def process_status_change_message(
    message: Mapping[str, Any], txn: Transaction | NoOpSpan
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

    if not features.has("organizations:issue-platform-api-crons-sd", organization):
        metrics.incr(
            "occurrence_ingest.status_change.dropped_feature_disabled",
            sample_rate=1.0,
        )
        txn.set_tag("result", "dropped_feature_disabled")
        return None

    with metrics.timer("occurrence_consumer._process_message.status_change.get_group"):
        group = get_group_from_fingerprint(status_change_data)
        if not group:
            metrics.incr(
                "occurrence_ingest.status_change.dropped_group_not_found",
                sample_rate=1.0,
            )
            return None
        txn.set_tag("group_id", group.id)

    with metrics.timer("occurrence_consumer._process_message.status_change.update_group_status"):
        update_status(group, status_change_data)

    return group  # group, is_regression
