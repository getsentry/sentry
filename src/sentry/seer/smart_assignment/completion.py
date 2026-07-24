from __future__ import annotations

import logging

from django.utils import timezone

from sentry import features
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.projectownership import ProjectOwnership
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.smart_assignment.scoring import record_prediction
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger(__name__)

AUTO_ASSIGN_FEATURE_FLAG = "organizations:seer-smart-assignment-assign"


def process_smart_assignment_completion(group: Group, activity: Activity) -> None:
    data = activity.data or {}
    predicted_assignee_user_ids: list[int | None] = data.get("predicted_assignee_user_ids") or []

    seer_run_id = data.get("run_id")
    run = (
        SeerAgentRun.objects.filter(run_id=seer_run_id).first() if seer_run_id is not None else None
    )
    if run is not None:
        # Save the prediction to the run so it can be scored, either now (if ground truth
        # already landed) or later (if ground truth hasn't landed yet).
        record_prediction(run, predicted_assignee_user_ids)

    _apply_prediction(group, predicted_assignee_user_ids, run_uuid=data.get("run_uuid"))


def _apply_prediction(
    group: Group,
    predicted_assignee_user_ids: list[int | None],
    run_uuid: str | None,
) -> None:
    """If the feature flag is enabled and we predicted an acutal org user,
    create a (suggested) GroupOwner for them. Then promote the suggestion to an
    assignment iff the project auto-assigns to owners."""
    if not features.has(AUTO_ASSIGN_FEATURE_FLAG, group.organization):
        return

    top_user_id = predicted_assignee_user_ids[0] if predicted_assignee_user_ids else None
    if top_user_id is None:
        # Agent abstained or named someone we couldn't map to an org user.
        metrics.incr(
            "smart_assignment.apply_prediction",
            tags={"outcome": "no_candidate"},
            sample_rate=1.0,
        )
        return

    if user_service.get_user(user_id=top_user_id) is None:
        # The top pick doesn't resolve to an org user.
        metrics.incr(
            "smart_assignment.apply_prediction",
            tags={"outcome": "user_missing"},
            sample_rate=1.0,
        )
        return

    # Persist the pick as a suggested owner (idempotent upsert).
    context: dict[str, object] = {"run_uuid": run_uuid} if run_uuid else {}
    GroupOwner.objects.update_or_create_and_preserve_context(
        lookup_kwargs={
            "group_id": group.id,
            "type": GroupOwnerType.SEER_SUGGESTED.value,
            "user_id": top_user_id,
            "project_id": group.project_id,
            "organization_id": group.organization.id,
        },
        defaults={"date_added": timezone.now()},
        context_defaults=context,
    )

    # Promote the suggestion to an assignment iff the project auto-assigns to owners.
    # The ASSIGNED activity written is tagged with ActivityIntegration.SEER_SUGGESTED so
    # ground-truth capture skips our own assignment (see scoring.record_ground_truth).
    ProjectOwnership.handle_auto_assignment(project_id=group.project_id, group=group)

    metrics.incr("smart_assignment.apply_prediction", tags={"outcome": "applied"}, sample_rate=1.0)
    logger.info(
        "smart_assignment.apply_prediction.applied",
        extra={"group_id": group.id, "user_id": top_user_id},
    )
