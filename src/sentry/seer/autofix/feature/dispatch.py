from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.group import Group
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import (
    AgentRunOptions,
    collect_user_org_context,
    get_proxy_headers,
)
from sentry.seer.agent.on_completion_hook import extract_hook_definition
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.feature.models import (
    FEATURE_ID,
    AutofixFeaturePayload,
    AutofixRCATweaks,
    RCAStepArgs,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import AutofixStoppingPoint, is_free_cohort_org
from sentry.seer.models.run import SeerRun
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AutofixFeatureArgs:
    step: AutofixStep
    referrer: AutofixReferrer
    step_args: RCAStepArgs
    user_context: str | None = None
    stopping_point: AutofixStoppingPoint | None = None
    allow_free_cohort: bool = False
    user: User | RpcUser | AnonymousUser | None = None
    enable_bash_tools: bool = False
    flush: bool = True


def trigger_autofix_feature(
    group: Group,
    args: AutofixFeatureArgs,
) -> SeerRun:
    # Avoid a circular import through the legacy Autofix dispatcher.
    from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

    # Free cohort orgs bypass quota only when called from night shift
    # (allow_free_cohort=True). Not exposed via the API.
    skip_quota = args.allow_free_cohort and is_free_cohort_org(group.organization)
    if not skip_quota:
        has_budget: bool = quotas.backend.check_seer_quota(
            org_id=group.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        if not has_budget:
            logger.warning(
                "autofix_feature.dispatch.quota_denied",
                extra={
                    "group_id": group.id,
                    "organization_id": group.organization.id,
                    "referrer": args.referrer.value,
                },
            )
            raise NoSeerQuotaException()

    rca_step_args = args.step_args
    payload = AutofixFeaturePayload(
        group_id=group.id,
        project_id=group.project_id,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        on_completion_hook=extract_hook_definition(AutofixOnCompletionHook, call_on_failure=True),
        repo_pins=rca_step_args.repo_pins,
        tweaks=AutofixRCATweaks(
            intelligence_level=rca_step_args.intelligence_level,
            reasoning_effort=rca_step_args.reasoning_effort,
            user_context=args.user_context,
        ),
        step=args.step,
        user_context=args.user_context,
        stopping_point=(args.stopping_point.value if args.stopping_point is not None else None),
        step_args=args.step_args,
    )

    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=args.user,
        enable_bash_tools=args.enable_bash_tools,
    )

    extras: dict[str, Any] = {
        "referrer": args.referrer.value,
    }
    # Store the stopping point here for delivery to use when advancing steps.
    if args.stopping_point is not None:
        extras["stopping_point"] = args.stopping_point.value

    run = client.start_feature_run(
        feature_id=FEATURE_ID,
        payload=payload.dict(),
        title=f"Autofix RCA — {payload.short_id}",
        flush=args.flush,
        extras=extras,
        referrer=args.referrer.value,
        user_org_context=collect_user_org_context(args.user, group.organization),
        proxy_headers=get_proxy_headers(),
        agent_run_options=AgentRunOptions(
            is_context_engine_enabled=False,
            enable_frontend_code_search=False,
        ),
    )

    if not skip_quota:
        quotas.backend.record_seer_run(
            group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
        )

    metrics.incr("autofix_feature.trigger", tags={"referrer": args.referrer.value})

    logger.info(
        "autofix_feature.dispatch.started",
        extra={
            "group_id": group.id,
            "organization_id": group.organization.id,
            "run_id": run.seer_run_state_id,
            "referrer": args.referrer.value,
            "stopping_point": args.stopping_point,
            "flush": args.flush,
            "allow_free_cohort": args.allow_free_cohort,
            "user_context": args.user_context,
            "enable_bash_tools": args.enable_bash_tools,
        },
    )

    return run
