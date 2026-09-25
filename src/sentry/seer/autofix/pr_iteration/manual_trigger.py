"""PR iteration feedback submitted from the Sentry UI.

A user who wants Seer to change a pull request it already opened can type
feedback into the autofix UI, which posts it to the group autofix endpoint
(``GroupAutofixEndpoint``) with ``step=pr_iteration``. The endpoint hands that
request to ``handle_ui_feedback`` here, which checks that the run can be
iterated on, then queues the feedback and asks for it to be consumed. This
module lives under ``pr_iteration`` so errors raised here are grouped with the
rest of PR iteration.
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.models.group import Group
from sentry.seer.autofix.autofix_agent import get_autofix_run_state
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.emit import bootstrap_iteration
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTriggerSource
from sentry.seer.autofix.pr_iteration.pause import PauseReason, get_pause_reason
from sentry.seer.autofix.pr_iteration.queue import enqueue_autofix_feedback
from sentry.seer.endpoints.utils import SEER_PERMISSION_DENIED
from sentry.seer.models import SeerPermissionError
from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

PAUSED_PR_ITERATION_DETAIL = {
    PauseReason.USER_STOP: "Iteration was stopped for this pull request",
    PauseReason.RUN_ERRORED: "Seer can no longer iterate on this pull request",
    PauseReason.PR_CLOSED: "This pull request is closed, so Seer stopped iterating on it",
}


def handle_ui_feedback(
    *,
    group: Group,
    run_id: int,
    user_id: int,
    user_feedback: str | None,
    referrer: AutofixReferrer,
) -> Response | None:
    """Queue feedback a user typed in the Sentry UI and ask for it to be consumed.

    Returns None once the feedback has been handed off, or the error response
    the endpoint should send back when the request cannot be acted on: 400 when
    the feature is off, the feedback is empty, or the run has no pull request
    yet, and 409 when iteration on the run is paused. Raises
    ``PermissionDenied`` when Seer refuses to show us the run.
    """
    if not features.has("organizations:autofix-pr-iteration-manual", group.organization):
        return Response(
            {"detail": "PR iteration is not enabled for this organization"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user_feedback:
        return Response(
            {"detail": "feedback is required for pr_iteration"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        run_state = get_autofix_run_state(group, run_id)
    except SeerPermissionError:
        raise PermissionDenied(SEER_PERMISSION_DENIED)

    if not run_state.get_created_pull_request_states():
        return Response(
            {"detail": "Cannot iterate on a PR before one has been created"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pause_reason = get_pause_reason(run_id=run_id, organization_id=group.organization.id)
    if pause_reason is not None:
        return Response(
            {"detail": PAUSED_PR_ITERATION_DETAIL[pause_reason]},
            status=status.HTTP_409_CONFLICT,
        )

    serialized_users = user_service.serialize_many(
        filter={"user_ids": [user_id]},
    )
    feedback = Feedback(
        source={
            "type": "user-ui",
            "user_id": user_id,
            "user": serialized_users[0] if serialized_users else None,
            "user_feedback": user_feedback,
        },
    )

    # Shared by both calls, so one arrival of feedback logs its queue
    # and trigger decisions under one identity.
    log_ctx = bootstrap_iteration(
        logger=logger,
        run_state=run_state,
        organization_id=group.organization.id,
        group_id=group.id,
    )

    enqueue_autofix_feedback(
        log_ctx=log_ctx,
        run_id=run_id,
        organization_id=group.organization.id,
        group_id=group.id,
        feedback=feedback,
        referrer=referrer,
        run_state=run_state,
        actor_user_id=user_id,
    )

    trigger_consume_pr_iteration_feedback(
        log_ctx=log_ctx,
        run_id=run_id,
        organization_id=group.organization.id,
        feedback=feedback,
        run_state=run_state,
        source=ConsumeTriggerSource.UI_CONSUME,
    )

    return None
