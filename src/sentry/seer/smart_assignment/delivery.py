from __future__ import annotations

import logging
from typing import Any

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.organizations.services.organization import organization_service
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID, AssigneeVerdict
from sentry.types.activity import ActivityType
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _resolve_identifier_to_user_id(
    organization_id: int, identifier: str | None, kind: str | None
) -> int | None:
    """Map an agent-produced `identifier` to a Sentry user id in the org.

    Returns None when the agent named no one or the identifier maps to no org user.
    """
    if not identifier:
        return None

    value = identifier.strip()
    if not value:
        return None

    if kind == "email":
        users = user_service.get_many_by_email(
            emails=[value], organization_id=organization_id, is_verified=True
        )
        return users[0].id if users else None

    if kind == "username":
        # use with_value_password=False to include SSO-only users
        users = user_service.get_by_username(
            username=value, with_valid_password=False, is_active=True
        )
        if not users:
            return None
        user_id = users[0].id
        member = organization_service.check_membership_by_id(
            organization_id=organization_id, user_id=user_id
        )
        return user_id if member is not None else None

    return None


def deliver_smart_assignment_result(
    organization_id: int,
    run_uuid: str,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    """Resolve a delivered smart_assignment verdict's ranked picks and record them.

    Emits a single `smart_assignment.delivery` counter tagged with the outcome so we
    can track success vs failure, how often the agent abstains, and how often it
    names someone we can't link to a Sentry user in the org:
      - `missing_run`   -- delivery arrived with no matching run mirror (orphaned run)
      - `error`         -- Seer run failed or returned no artifact
      - `missing_group` -- run isn't tied to a group, or the group was deleted before
                           delivery, so there's nothing to record the prediction against
      - `duplicate`     -- a completion activity already exists for this run (Seer retry
                           or redelivery), so we skip re-recording it
      - `abstain`       -- completed, but the agent named no one
      - `unlinked`      -- named someone we couldn't map to an org user
      - `resolved`      -- named someone we mapped to a Sentry user
    """
    agent_run = (
        SeerAgentRun.objects.filter(
            run__uuid=run_uuid, run__organization_id=organization_id, source=SEER_FEATURE_ID
        )
        .select_related("run")
        .first()
    )
    if agent_run is None:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "missing_run"})
        logger.warning(
            "smart_assignment.delivery.missing_run",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        return

    group_id = agent_run.group_id
    log_extra = {"organization_id": organization_id, "group_id": group_id, "run_uuid": run_uuid}

    if status == "error" or result is None:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "error"})
        logger.warning(
            "smart_assignment.delivery.no_result",
            extra={**log_extra, "status": status, "error": error},
        )
        return

    try:
        verdict = AssigneeVerdict.parse_obj(result)
    except Exception:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "error"})
        logger.warning("smart_assignment.delivery.invalid_result", extra=log_extra)
        return

    # Resolve every ranked candidate to a Sentry user, best-first.
    predicted_assignee_user_ids = [
        _resolve_identifier_to_user_id(
            organization_id, candidate.identifier, candidate.identifier_kind
        )
        for candidate in verdict.candidates
    ]

    # Do nothing if the group was deleted before delivery, or if the run isn't tied to a group.
    group = Group.objects.filter(id=group_id).first() if group_id is not None else None
    if group is None:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "missing_group"})
        logger.warning("smart_assignment.delivery.missing_group", extra=log_extra)
        return

    # A Seer retry or redelivery re-invokes this handler for the same run. The completion
    # activity is this feature's system of record, and creating it re-runs scoring/
    # auto-assignment via the workflow handlers, so skip if we already recorded one for
    # this run. Activity carries no unique constraint, so this is a best-effort pre-check;
    # it covers sequential redelivery but not a concurrent-redelivery race.
    already_recorded = any(
        (activity.data or {}).get("run_id") == agent_run.id
        for activity in Activity.objects.filter(
            group=group, type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
        )
    )
    if already_recorded:
        metrics.incr("smart_assignment.delivery", tags={"outcome": "duplicate"})
        logger.info("smart_assignment.delivery.duplicate", extra=log_extra)
        return

    # Hand the resolved verdict off to the completion path via an activity that points
    # back at this run. Creating it invokes the workflow activity handlers, which score
    # the prediction (completing the pair now if ground truth already landed) and
    # auto-assign as needed.
    Activity.objects.create_group_activity(
        group,
        ActivityType.SMART_ASSIGNMENT_COMPLETED,
        data={
            "run_id": agent_run.id,
            "run_uuid": run_uuid,
            "predicted_assignee_user_ids": predicted_assignee_user_ids,
        },
        send_notification=False,
    )

    if not predicted_assignee_user_ids:
        outcome = "abstain"
    elif predicted_assignee_user_ids[0] is None:
        outcome = "unlinked"
    else:
        outcome = "resolved"
    metrics.incr("smart_assignment.delivery", tags={"outcome": outcome})
