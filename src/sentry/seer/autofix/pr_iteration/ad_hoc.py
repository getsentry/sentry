"""Sentry-side orchestration for Seer's ad-hoc PR-iteration feature.

Seer owns the fresh background chat, prompts, tools, and PR-update execution.
This module defines the dispatch/result contract and tracks the source batch.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID

from django.db import router, transaction
from pydantic import BaseModel, Field

from sentry import features
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import (
    collect_user_org_context,
    get_proxy_headers,
    has_seer_agent_access_with_detail,
)
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.details_store import (
    get_iteration,
    open_iterations,
    update_iteration,
)
from sentry.seer.autofix.pr_iteration.emit import PrIterationOutcome, finish_pr_iteration_details
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.iterations import PrIterationNoPullRequestException
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.pause import PauseReason, pause_pr_iteration
from sentry.seer.autofix.pr_iteration.queue import count_queued_autofix_feedback
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.users.services.user.service import user_service
from sentry.utils import json

logger = logging.getLogger(__name__)

FEATURE_ID = "adhoc_pr_iteration"


class AdHocPrIterationPayload(BaseModel):
    """Contract for starting a fresh, non-interactive Seer feature run.

    Feedback carries source data and timestamps, not Sentry-rendered prompts.
    Seer must deliver a terminal result through ``deliver_feature_result``.
    """

    # Correlation only: Seer must not continue this original conversation.
    source_run_id: int
    iteration_id: int
    pr_urls: dict[str, str]
    feedback: list[dict[str, Any]]


class AdHocPrIterationResult(BaseModel):
    """Seer reports the outcome; Sentry does not infer it from chat/tool state.

    ``already_pushed`` means the PR update has finished, not merely been queued.
    """

    outcome: Literal["already_pushed", "no_code_changes", "chat_completed"]
    head_shas: list[str] = Field(default_factory=list)


def ad_hoc_iteration_running(organization_id: int, source_run_id: int) -> bool:
    source = SeerRun.objects.filter(
        organization_id=organization_id, seer_run_state_id=source_run_id
    ).first()
    return source is not None and any(
        row.triggered and row.data.get("execution_seer_run_id") for row in open_iterations(source)
    )


def consume_ad_hoc_pr_iteration_feedback(
    *,
    log_ctx: PrIterationLogContext,
    state: SeerRunState,
    organization_id: int,
    feedback: Sequence[Feedback],
    iteration_id: int | None,
    referrer: AutofixReferrer,
) -> SeerRun:
    organization = Organization.objects.get_from_cache(id=organization_id)
    source = SeerRun.objects.get(organization_id=organization_id, seer_run_state_id=state.run_id)
    user = user_service.get_user(user_id=source.user_id) if source.user_id is not None else None
    if (
        user is None
        or not user.is_active
        or not OrganizationMember.objects.filter(
            organization_id=organization_id, user_id=user.id
        ).exists()
    ):
        raise SeerPermissionError("The original Ask Seer run owner no longer has access")

    has_access, detail = has_seer_agent_access_with_detail(organization, user)
    if not has_access:
        raise SeerPermissionError(detail or "Ask Seer access is not enabled")
    if not features.has("organizations:ask-seer-create-pr", organization, actor=user):
        raise SeerPermissionError("Ask Seer pull request writing is not enabled")

    pr_urls = {
        pr.repo_name: pr.pr_url for pr in state.get_created_pull_request_states() if pr.pr_url
    }
    if not pr_urls:
        raise PrIterationNoPullRequestException()
    iteration = get_iteration(source, iteration_id) if iteration_id is not None else None
    if iteration is None:
        raise ValueError("Ad-hoc PR iteration feedback has no iteration bookkeeping row")

    payload = AdHocPrIterationPayload(
        source_run_id=state.run_id,
        iteration_id=iteration.id,
        pr_urls=pr_urls,
        feedback=[json.loads(item.json(exclude={"text", "ui_text"})) for item in feedback],
    )

    def link_execution(run: SeerRun) -> None:
        # The feature mirror and source-batch link are committed before dispatch.
        update_iteration(iteration, execution_seer_run_id=run.id)

    run = SeerAgentClient(organization, user).start_feature_run(
        feature_id=FEATURE_ID,
        payload=payload.dict(),
        title="Ad-hoc PR iteration",
        referrer=referrer.value,
        extras={"source_run_id": state.run_id, "iteration_id": iteration.id, "status": "running"},
        user_org_context=collect_user_org_context(user, organization),
        proxy_headers=get_proxy_headers(),
        on_run_created=link_execution,
    )
    log_ctx.info(
        "autofix.pr_iteration.consume_feedback.ad_hoc_started",
        iteration_type="ad_hoc",
        execution_run_id=run.seer_run_state_id,
        feedback_count=len(feedback),
    )
    return run


def deliver_ad_hoc_pr_iteration_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    """Correlate Seer's terminal result to the source batch, once per execution."""
    with transaction.atomic(router.db_for_write(SeerAgentRun)):
        execution = (
            SeerAgentRun.objects.select_for_update(of=("self",))
            .select_related("run__organization")
            .filter(run__organization_id=organization_id, run__uuid=run_uuid, source=FEATURE_ID)
            .first()
        )
        if execution is None or execution.extras.get("status") in ("completed", "error"):
            return
        parsed = AdHocPrIterationResult.parse_obj(result) if status == "completed" else None
        source_run_id = execution.extras["source_run_id"]
        source = SeerRun.objects.get(
            organization_id=organization_id, seer_run_state_id=source_run_id
        )
        iteration = get_iteration(source, execution.extras["iteration_id"])
        execution.update(
            extras={
                **execution.extras,
                "status": status,
                "error": error,
                "prompt_version": prompt_version,
            }
        )
        if iteration is None:
            return
        log_ctx = PrIterationLogContext.for_run_id(logger, source_run_id, organization_id, None)
        finish_pr_iteration_details(
            log_ctx=log_ctx,
            run_id=source_run_id,
            organization_id=organization_id,
            iteration_id=iteration.id,
            outcome=parsed.outcome if parsed else PrIterationOutcome.ERRORED.value,
            head_shas=parsed.head_shas if parsed and parsed.outcome == "already_pushed" else [],
        )

    if status == "error":
        pause_pr_iteration(
            run_id=source_run_id, organization_id=organization_id, reason=PauseReason.RUN_ERRORED
        )
    elif count_queued_autofix_feedback(source_run_id):
        # Completion imports the task module, which imports this consumer.
        from sentry.seer.autofix.pr_iteration.completion import consume_queued_feedback

        consume_queued_feedback(log_ctx, execution.run.organization, source_run_id)
