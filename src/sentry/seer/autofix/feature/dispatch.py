from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q, QuerySet

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
    LEGACY_FEATURE_ID,
    AutofixFeaturePayload,
    CodeChangesStepArgs,
    PrIterationStepArgs,
    RCAStepArgs,
    SolutionStepArgs,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import AutofixStoppingPoint, is_free_cohort_org
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.models.seer_api_models import UNKNOWN_RUN_ID_FOR_GROUP, SeerPermissionError
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AutofixFeatureArgs:
    step: AutofixStep
    referrer: AutofixReferrer
    step_args: RCAStepArgs | SolutionStepArgs | CodeChangesStepArgs | PrIterationStepArgs
    existing_run_id: int | None = None
    insert_index: int | None = None
    user_context: str | None = None
    stopping_point: AutofixStoppingPoint | None = None
    allow_free_cohort: bool = False
    user: User | RpcUser | AnonymousUser | None = None
    enable_bash_mode: bool = False
    flush: bool = True


def _run_mirrors(group: Group, run_id: int) -> QuerySet[SeerAgentRun]:
    return SeerAgentRun.objects.filter(
        run__organization_id=group.organization.id,
        run__seer_run_state_id=run_id,
    )


def _mirror_matches_issue(group: Group) -> Q:
    # A missing project means the row predates project binding. The group is
    # already one project, so a matching group is enough for those rows.
    return Q(group_id=group.id) & (Q(project_id=group.project_id) | Q(project_id__isnull=True))


def autofix_run_targets_other_issue(group: Group, run_id: int) -> bool:
    """True when this org has a run mirror for ``run_id`` on another issue.

    No mirror is not foreign: older runs are still checked via Seer metadata.
    A mirror on a different group or project is foreign, even when that metadata
    echoes the caller's issue.
    """
    mirrors = _run_mirrors(group, run_id)
    if not mirrors.exists():
        return False
    return not mirrors.filter(_mirror_matches_issue(group)).exists()


def require_autofix_run_for_group(group: Group, run_id: int) -> SeerAgentRun:
    """The autofix run mirror for this issue, or a permission error.

    ``run_id`` comes from the request body. Org membership is not enough: the
    mirror must be this issue's group and project, or a member can continue a
    run on a project they cannot access by keeping their own issue in the URL.
    """
    agent_run = (
        _run_mirrors(group, run_id)
        .filter(source__in=(FEATURE_ID, LEGACY_FEATURE_ID))
        .select_related("run")
        .filter(_mirror_matches_issue(group))
        .first()
    )
    if agent_run is None:
        raise SeerPermissionError(UNKNOWN_RUN_ID_FOR_GROUP)
    return agent_run


def trigger_autofix_feature(
    group: Group,
    args: AutofixFeatureArgs,
) -> SeerRun:
    # Avoid a circular import through the legacy Autofix dispatcher.
    from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

    is_new_run = args.existing_run_id is None
    # Free cohort orgs bypass quota only when called from agentic triage
    # (allow_free_cohort=True). Not exposed via the API.
    skip_quota = is_new_run and args.allow_free_cohort and is_free_cohort_org(group.organization)
    if is_new_run and not skip_quota:
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

    payload = AutofixFeaturePayload(
        group_id=group.id,
        project_id=group.project_id,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        on_completion_hook=extract_hook_definition(AutofixOnCompletionHook, call_on_failure=True),
        step=args.step,
        existing_run_id=args.existing_run_id,
        insert_index=args.insert_index,
        user_context=args.user_context,
        stopping_point=(args.stopping_point.value if args.stopping_point is not None else None),
        step_args=args.step_args,
    )

    enable_coding = args.step in (AutofixStep.CODE_CHANGES, AutofixStep.PR_ITERATION)
    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=args.user,
        enable_bash_mode=args.enable_bash_mode,
        enable_coding=enable_coding,
    )

    agent_run_options = AgentRunOptions(
        is_context_engine_enabled=False,
        enable_frontend_code_search=False,
        enable_coding=enable_coding,
        enable_pr_context_tools=args.step == AutofixStep.PR_ITERATION,
    )

    extras: dict[str, Any] = {
        "referrer": args.referrer.value,
    }
    # Store the stopping point here for delivery to use when advancing steps.
    if args.stopping_point is not None:
        extras["stopping_point"] = args.stopping_point.value

    user_org_context = collect_user_org_context(args.user, group.organization)
    if is_new_run:
        run = client.start_feature_run(
            feature_id=FEATURE_ID,
            payload=payload.dict(),
            referrer=args.referrer.value,
            user_org_context=user_org_context,
            proxy_headers=get_proxy_headers(),
            agent_run_options=agent_run_options,
            title=f"Autofix RCA — {payload.short_id}",
            flush=args.flush,
            extras=extras,
        )
    elif args.existing_run_id is not None:
        existing_agent_run = require_autofix_run_for_group(group, args.existing_run_id)

        run = client.continue_feature_run(
            existing_agent_run=existing_agent_run,
            payload=payload.dict(),
            referrer=args.referrer.value,
            user_org_context=user_org_context,
            proxy_headers=get_proxy_headers(),
            agent_run_options=agent_run_options,
        )
    else:
        raise Exception("Unhandled run_id branch, this should never happen")

    if is_new_run and not skip_quota:
        quotas.backend.record_seer_run(
            group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
        )

    metrics.incr(
        "autofix_feature.trigger",
        tags={"referrer": args.referrer.value, "step": args.step.value},
        sample_rate=1,
    )

    logger.info(
        "autofix_feature.dispatch.started",
        extra={
            "step": args.step.value,
            "group_id": group.id,
            "organization_id": group.organization.id,
            "run_id": run.seer_run_state_id,
            "referrer": args.referrer.value,
            "stopping_point": args.stopping_point,
            "flush": args.flush,
            "allow_free_cohort": args.allow_free_cohort,
            "has_user_context": args.user_context is not None,
            "enable_bash_mode": args.enable_bash_mode,
        },
    )

    return run
