from __future__ import annotations

import logging
from typing import Any, Literal

from django.contrib.auth.models import AnonymousUser

from sentry.models.group import Group
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import AgentRunOptions, collect_user_org_context
from sentry.seer.agent.on_completion_hook import extract_hook_definition
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feature.models import FEATURE_ID, AutofixPayload, AutofixStepArgs
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def trigger_autofix_solution_feature(
    group: Group,
    *,
    run_id: int,
    referrer: AutofixReferrer,
    user_context: str | None = None,
    insert_index: int | None = None,
    intelligence_level: Literal["low", "medium", "high"] = "medium",
    reasoning_effort: Literal["low", "medium", "high"] | None = None,
    flush: bool = True,
    user: User | RpcUser | AnonymousUser | None = None,
    enable_bash_tools: bool = False,
) -> SeerRun:
    """Continue an Autofix run with Seer's solution feature.

    Solution is a continuation, so quota was already consumed by the run's
    root-cause kickoff.
    """
    payload = AutofixPayload(
        group_id=group.id,
        step=AutofixStep.SOLUTION,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        on_completion_hook=extract_hook_definition(AutofixOnCompletionHook, call_on_failure=True),
        args=AutofixStepArgs(
            run_id=run_id,
            insert_index=insert_index,
            intelligence_level=intelligence_level,
            reasoning_effort=reasoning_effort,
            user_context=user_context,
        ),
    )

    previous_extras = (
        SeerAgentRun.objects.filter(
            run__organization_id=group.organization.id,
            run__seer_run_state_id=run_id,
            group_id=group.id,
        )
        .values_list("extras", flat=True)
        .first()
        or {}
    )
    extras: dict[str, Any] = {
        "referrer": referrer.value,
        "previous_run_id": run_id,
    }
    if stopping_point := previous_extras.get("stopping_point"):
        extras["stopping_point"] = stopping_point

    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=user,
        enable_bash_tools=enable_bash_tools,
    )
    run = client.start_feature_run(
        feature_id=FEATURE_ID,
        payload=payload.dict(),
        title=f"Autofix Solution — {payload.short_id}",
        flush=flush,
        extras=extras,
        referrer=referrer.value,
        user_org_context=collect_user_org_context(user, group.organization),
        agent_run_options=AgentRunOptions(
            is_context_engine_enabled=False,
            enable_frontend_code_search=False,
        ),
    )

    metrics.incr("autofix_solution.feature.trigger", tags={"referrer": referrer.value})

    logger.info(
        "autofix_solution.dispatch.started",
        extra={
            "group_id": group.id,
            "organization_id": group.organization.id,
            "previous_run_id": run_id,
            "run_id": run.seer_run_state_id,
            "referrer": referrer.value,
        },
    )

    return run
