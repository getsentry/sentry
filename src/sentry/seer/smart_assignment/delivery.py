from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

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


class _DeliveryAborted(Exception):
    """Control-flow signal: a step is stopping delivery early"""


def _incr(outcome: str) -> None:
    metrics.incr("smart_assignment.delivery", tags={"outcome": outcome}, sample_rate=1.0)


def _validate_run(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> int:
    """Load the run mirror and confirm the delivery carries a usable result.

    Returns the SeerRun id, or emits the tagged outcome and aborts for an orphaned run
    (`missing_run`) or a failed/empty delivery (`error`).
    """
    agent_run = (
        SeerAgentRun.objects.filter(
            run__uuid=run_uuid, run__organization_id=organization_id, source=SEER_FEATURE_ID
        )
        .select_related("run")
        .first()
    )
    if agent_run is None:
        _incr("missing_run")
        logger.warning(
            "smart_assignment.delivery.missing_run",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        raise _DeliveryAborted

    if status == "error" or result is None:
        _incr("error")
        logger.warning(
            "smart_assignment.delivery.no_result",
            extra={
                "organization_id": organization_id,
                "group_id": agent_run.group_id,
                "run_uuid": run_uuid,
                "status": status,
                "error": error,
            },
        )
        raise _DeliveryAborted

    return agent_run.run_id


def _validate_group(organization_id: int, run_uuid: UUID) -> Group:
    """Load the live group the run is tied to, to record the prediction against.

    Reaches the group through the run mirror in a single query. Emits `missing_group` and
    aborts when the run isn't tied to a group, or the group was deleted before delivery.
    """
    group = Group.objects.filter(
        seeragentrun__run__uuid=run_uuid,
        seeragentrun__source=SEER_FEATURE_ID,
        project__organization_id=organization_id,
    ).first()
    if group is None:
        _incr("missing_group")
        logger.warning(
            "smart_assignment.delivery.missing_group",
            extra={"organization_id": organization_id, "run_uuid": run_uuid},
        )
        raise _DeliveryAborted

    return group


def _validate_resolve_verdict(
    organization_id: int, result: dict[str, Any] | None, log_extra: dict[str, Any]
) -> list[int | None]:
    """Parse the delivered artifact and resolve each ranked candidate to a Sentry user id.

    Returns the resolved ids best-first, where a slot is None when that candidate names
    no resolvable org user (blank identifier, an email with no verified org user, or a
    username outside this org). Emits `error` and aborts when the artifact doesn't parse.
    """
    try:
        verdict = AssigneeVerdict.parse_obj(result)
    except Exception:
        _incr("error")
        logger.warning("smart_assignment.delivery.invalid_result", extra=log_extra)
        raise _DeliveryAborted from None

    resolved: list[int | None] = []
    for candidate in verdict.candidates:
        value = (candidate.identifier or "").strip()
        if not value:
            resolved.append(None)
            continue

        if candidate.identifier_kind == "email":
            users = user_service.get_many_by_email(
                emails=[value], organization_id=organization_id, is_verified=True
            )
            resolved.append(users[0].id if users else None)
            continue

        if candidate.identifier_kind == "username":
            # with_valid_password=False so SSO-only users are included.
            users = user_service.get_by_username(
                username=value, with_valid_password=False, is_active=True
            )
            member = (
                organization_service.check_membership_by_id(
                    organization_id=organization_id, user_id=users[0].id
                )
                if users
                else None
            )
            resolved.append(users[0].id if member is not None else None)

    return resolved


def _record_result(
    group: Group,
    seer_run_id: int,
    run_uuid: UUID,
    predicted_assignee_user_ids: list[int | None],
    log_extra: dict[str, Any],
) -> None:
    """Record the resolved verdict as a completion activity and emit the delivery outcome.

    A Seer retry or redelivery re-invokes this handler for the same run. The completion
    activity is this feature's system of record, and creating it re-runs scoring/
    auto-assignment via the workflow handlers, so skip (as `duplicate`) if we already
    recorded one for this run. Activity carries no unique constraint, so this is a
    best-effort pre-check; it covers sequential redelivery but not a concurrent race.
    """
    already_recorded = any(
        (activity.data or {}).get("run_id") == seer_run_id
        for activity in Activity.objects.filter(
            group=group, type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value
        )
    )
    if already_recorded:
        _incr("duplicate")
        logger.info("smart_assignment.delivery.duplicate", extra=log_extra)
        raise _DeliveryAborted

    # Hand the resolved verdict off to the completion path via an activity that points
    # back at this run. Creating it invokes the workflow activity handlers, which score
    # the prediction (completing the pair now if ground truth already landed) and
    # auto-assign as needed.
    Activity.objects.create_group_activity(
        group,
        ActivityType.SMART_ASSIGNMENT_COMPLETED,
        data={
            "run_id": seer_run_id,
            "run_uuid": str(run_uuid),
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
    _incr(outcome)


def deliver_smart_assignment_result(
    organization_id: int,
    run_uuid: UUID,
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
    try:
        seer_run_id = _validate_run(organization_id, run_uuid, status, result, error)
        group = _validate_group(organization_id, run_uuid)
        log_extra = {
            "organization_id": organization_id,
            "group_id": group.id,
            "run_uuid": run_uuid,
        }
        predicted_assignee_user_ids = _validate_resolve_verdict(organization_id, result, log_extra)
        _record_result(group, seer_run_id, run_uuid, predicted_assignee_user_ids, log_extra)
    except _DeliveryAborted:
        return
