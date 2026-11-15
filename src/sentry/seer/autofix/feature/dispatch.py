from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q, QuerySet

from sentry import features, quotas
from sentry.constants import (
    ENABLE_SEER_CODING_DEFAULT,
    DataCategory,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import (
    AgentRunOptions,
    collect_user_org_context,
    get_proxy_headers,
)
from sentry.seer.agent.on_completion_hook import extract_hook_definition
from sentry.seer.autofix.commit_author import SeerCommitAuthor
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException, SeerOutOfCreditsException
from sentry.seer.autofix.feature.models import (
    FEATURE_ID,
    LEGACY_FEATURE_ID,
    SINGLE_RUN_FEATURE_ID,
    AutofixFeaturePayload,
    AutofixSingleRunFeaturePayload,
    AutofixSingleRunPrInternalSettings,
    CodeChangesStepArgs,
    PrIterationStepArgs,
    RCAStepArgs,
    SolutionStepArgs,
)
from sentry.seer.autofix.pr_iteration.feedback import (
    Feedback,
    feedback_text,
    serialize_feedback,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    get_automation_handoff,
    get_event_matched_project_repo_ids,
    is_free_cohort_org,
)
from sentry.seer.credits import SeerFeature, SeerOperation, has_enough_seer_credits
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
    flush: bool = True
    single_run: bool = False


def _run_mirrors(group: Group, run_id: int) -> QuerySet[SeerAgentRun]:
    return SeerAgentRun.objects.filter(
        run__organization_id=group.organization.id,
        run__seer_run_state_id=run_id,
    )


def _mirror_matches_issue(group: Group) -> Q:
    return Q(group_id=group.id, project_id=group.project_id)


def autofix_run_targets_other_issue(group: Group, run_id: int) -> bool:
    """True unless ``run_id`` is mirrored to this issue's group and project.

    Autofix runs are stored with both when they start, so a missing row is not
    this issue's run.
    """
    return not _run_mirrors(group, run_id).filter(_mirror_matches_issue(group)).exists()


def require_autofix_run_for_group(
    group: Group, run_id: int, sources: tuple[str, ...] = (FEATURE_ID, LEGACY_FEATURE_ID)
) -> SeerAgentRun:
    """The autofix run mirror for this issue, or a permission error.

    ``run_id`` comes from the request body. Org membership is not enough: the
    mirror must be this issue's group and project, or a member can continue a
    run on a project they cannot access by keeping their own issue in the URL.
    """
    agent_run = (
        _run_mirrors(group, run_id)
        .filter(source__in=sources)
        .select_related("run")
        .filter(_mirror_matches_issue(group))
        .first()
    )
    if agent_run is None:
        raise SeerPermissionError(UNKNOWN_RUN_ID_FOR_GROUP)
    return agent_run


def should_use_single_run(
    group: Group,
    step: str,
    *,
    existing_run_id: int | None = None,
    single_run_requested: bool = False,
) -> bool:
    # Only fresh root-cause starts qualify: later steps and retries continue step-by-step runs,
    # and coding-agent handoff only exists in that flow (AIML-3808).
    if step != AutofixStep.ROOT_CAUSE or existing_run_id is not None:
        return False
    if get_automation_handoff(group.project.get_option) is not None:
        return False
    return single_run_requested or features.has(
        "organizations:autofix-single-run", group.organization
    )


def _single_run_pr_internal_settings(
    group: Group,
    referrer: AutofixReferrer,
    commit_author: SeerCommitAuthor | None = None,
) -> AutofixSingleRunPrInternalSettings:
    from sentry.seer.autofix.autofix_agent import (
        build_pr_description_suffix,
        should_open_autofix_pr_as_draft,
    )

    return AutofixSingleRunPrInternalSettings(
        description_suffix=build_pr_description_suffix(group, referrer),
        ready_for_review=not should_open_autofix_pr_as_draft(group.organization),
        commit_author=commit_author,
    )


def _org_allows_coding(group: Group) -> bool:
    return bool(
        group.organization.get_option(
            "sentry:enable_seer_coding", default=ENABLE_SEER_CODING_DEFAULT
        )
    )


def check_autofix_billing(
    organization: Organization,
    operation: SeerOperation,
    *,
    is_new_run: bool,
    skip_quota_for_free_cohort: bool = False,
) -> bool:
    """
    Raise if the organization can't pay for the operation. Token-billed orgs are
    checked for credits, and everyone else is checked for quota once per run.
    Returns whether the operation uses quota.
    """
    # Check credits for token-billed orgs.
    if features.has("organizations:token-billed-seer-enabled", organization):
        if features.has(
            "organizations:seer-credit-checks", organization
        ) and not has_enough_seer_credits(organization, SeerFeature.AUTOFIX, operation):
            raise SeerOutOfCreditsException()
        return False

    # Check quota for non-token-billed orgs once per run.
    # Free cohort orgs skip quota when the caller passes skip_quota_for_free_cohort=True.
    # Only agentic triage does, and it is not exposed via API.
    skips_quota = skip_quota_for_free_cohort and is_free_cohort_org(organization)
    uses_quota = is_new_run and not skips_quota
    if uses_quota and not quotas.backend.check_seer_quota(
        org_id=organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    ):
        raise NoSeerQuotaException()
    return uses_quota


def continue_single_run(
    agent_run: SeerAgentRun,
    group: Group,
    reply: str,
    *,
    user: User | RpcUser,
    can_publish: bool,
    referrer: AutofixReferrer,
) -> SeerRun:
    check_autofix_billing(
        group.organization,
        SeerOperation.AUTOFIX_SINGLE_RUN_REPLY,
        is_new_run=False,
    )
    enable_coding = _org_allows_coding(group)
    open_pr = enable_coding and can_publish
    return _continue_single_run(
        agent_run,
        group,
        reply=reply,
        user=user,
        enable_coding=enable_coding,
        pr_internal_settings=(
            _single_run_pr_internal_settings(group, referrer) if open_pr else None
        ),
        enable_pr_context_tools=False,
        referrer=referrer,
    )


def continue_single_run_from_pr_feedback(
    agent_run: SeerAgentRun,
    group: Group,
    *,
    feedback: Sequence[Feedback],
    iteration_index: int,
    iteration_id: int | None,
    commit_author: SeerCommitAuthor | None,
    referrer: AutofixReferrer,
) -> SeerRun:
    check_autofix_billing(
        group.organization,
        SeerOperation.AUTOFIX_PR_ITERATION,
        is_new_run=False,
    )
    enable_coding = _org_allows_coding(group)
    return _continue_single_run(
        agent_run,
        group,
        reply=feedback_text(feedback),
        user=None,
        enable_coding=enable_coding,
        pr_internal_settings=(
            _single_run_pr_internal_settings(group, referrer, commit_author)
            if enable_coding
            else None
        ),
        enable_pr_context_tools=True,
        referrer=referrer,
        pr_feedback=PrIterationStepArgs(
            iteration_index=iteration_index,
            iteration_id=iteration_id,
            feedback=serialize_feedback(feedback),
        ),
    )


def _continue_single_run(
    agent_run: SeerAgentRun,
    group: Group,
    *,
    reply: str,
    user: User | RpcUser | None,
    enable_coding: bool,
    pr_internal_settings: AutofixSingleRunPrInternalSettings | None,
    enable_pr_context_tools: bool,
    referrer: AutofixReferrer,
    pr_feedback: PrIterationStepArgs | None = None,
) -> SeerRun:
    from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

    payload = AutofixSingleRunFeaturePayload(
        group_id=group.id,
        project_id=group.project_id,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        on_completion_hook=extract_hook_definition(AutofixOnCompletionHook, call_on_failure=True),
        should_run_repo_checks=True,
        existing_run_id=agent_run.run.seer_run_state_id,
        reply=reply,
        pr_internal_settings=pr_internal_settings,
        pr_feedback=pr_feedback,
    )
    agent_run_options = AgentRunOptions(
        is_context_engine_enabled=False,
        enable_frontend_code_search=False,
        enable_coding=enable_coding,
        enable_pr_context_tools=enable_pr_context_tools,
        enable_write_pull_request=pr_internal_settings is not None,
    )

    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=user,
        enable_coding=enable_coding,
        enable_bash_mode=True,
    )
    return client.continue_feature_run(
        existing_agent_run=agent_run,
        payload=payload.dict(),
        referrer=referrer.value,
        user_org_context=collect_user_org_context(
            user,
            group.organization,
            priority_project_repo_ids=get_event_matched_project_repo_ids(group),
        ),
        proxy_headers=get_proxy_headers(),
        agent_run_options=agent_run_options,
    )


def trigger_autofix_feature(
    group: Group,
    args: AutofixFeatureArgs,
) -> SeerRun:
    # Avoid a circular import through the legacy Autofix dispatcher.
    from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

    is_new_run = args.existing_run_id is None
    try:
        uses_quota = check_autofix_billing(
            group.organization,
            args.step.seer_operation,
            is_new_run=is_new_run,
            # Free cohort orgs bypass quota only when called from agentic triage
            # (allow_free_cohort=True). Not exposed via the API.
            skip_quota_for_free_cohort=args.allow_free_cohort,
        )
    except NoSeerQuotaException:
        logger.warning(
            "autofix_feature.dispatch.quota_denied",
            extra={
                "group_id": group.id,
                "organization_id": group.organization.id,
                "referrer": args.referrer.value,
            },
        )
        raise
    except SeerOutOfCreditsException:
        logger.info(
            "autofix_feature.dispatch.out_of_credits",
            extra={
                "group_id": group.id,
                "organization_id": group.organization.id,
                "operation": args.step.seer_operation.value,
                "referrer": args.referrer.value,
            },
        )
        raise

    single_run = should_use_single_run(
        group,
        args.step,
        existing_run_id=args.existing_run_id,
        single_run_requested=args.single_run,
    )
    stopping_point = (
        (args.stopping_point or AutofixStoppingPoint.CODE_CHANGES)
        if single_run
        else args.stopping_point
    )
    on_completion_hook = extract_hook_definition(AutofixOnCompletionHook, call_on_failure=True)
    short_id = group.qualified_short_id or str(group.id)
    title = group.title or "Unknown error"
    culprit = group.culprit or "unknown"

    payload: AutofixFeaturePayload | AutofixSingleRunFeaturePayload
    if single_run:
        if not isinstance(args.step_args, RCAStepArgs):
            raise ValueError("Single runs need root cause step args")
        payload = AutofixSingleRunFeaturePayload(
            group_id=group.id,
            project_id=group.project_id,
            short_id=short_id,
            title=title,
            culprit=culprit,
            on_completion_hook=on_completion_hook,
            intelligence_level=args.step_args.intelligence_level,
            reasoning_effort=args.step_args.reasoning_effort,
            repo_pins=args.step_args.repo_pins,
            user_context=args.user_context,
            should_run_repo_checks=True,
        )
        enable_coding = stopping_point in (
            AutofixStoppingPoint.CODE_CHANGES,
            AutofixStoppingPoint.OPEN_PR,
        ) and _org_allows_coding(group)
        open_pr = enable_coding and stopping_point == AutofixStoppingPoint.OPEN_PR
        if open_pr:
            payload.pr_internal_settings = _single_run_pr_internal_settings(group, args.referrer)
    else:
        payload = AutofixFeaturePayload(
            group_id=group.id,
            project_id=group.project_id,
            short_id=short_id,
            title=title,
            culprit=culprit,
            on_completion_hook=on_completion_hook,
            step=args.step,
            existing_run_id=args.existing_run_id,
            insert_index=args.insert_index,
            user_context=args.user_context,
            stopping_point=(args.stopping_point.value if args.stopping_point is not None else None),
            step_args=args.step_args,
        )
        enable_coding = args.step in (AutofixStep.CODE_CHANGES, AutofixStep.PR_ITERATION)
        open_pr = False

    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=args.user,
        enable_coding=enable_coding,
        enable_bash_mode=True,
    )

    agent_run_options = AgentRunOptions(
        is_context_engine_enabled=False,
        enable_frontend_code_search=False,
        enable_coding=enable_coding,
        enable_pr_context_tools=args.step == AutofixStep.PR_ITERATION,
    )
    if args.step == AutofixStep.PR_ITERATION and features.has(
        "organizations:autofix-pr-iteration-pin-to-pr-head", group.organization
    ):
        agent_run_options["pin_to_pr_head"] = True
    if open_pr:
        agent_run_options["enable_write_pull_request"] = True

    extras: dict[str, Any] = {
        "referrer": args.referrer.value,
    }
    # Store the stopping point here for delivery to use when advancing steps.
    if stopping_point is not None:
        extras["stopping_point"] = stopping_point.value

    user_org_context = collect_user_org_context(
        args.user,
        group.organization,
        priority_project_repo_ids=get_event_matched_project_repo_ids(group),
    )
    if is_new_run:
        run = client.start_feature_run(
            feature_id=SINGLE_RUN_FEATURE_ID if single_run else FEATURE_ID,
            payload=payload.dict(),
            referrer=args.referrer.value,
            user_org_context=user_org_context,
            proxy_headers=get_proxy_headers(),
            agent_run_options=agent_run_options,
            title=f"Autofix — {short_id}" if single_run else f"Autofix RCA — {short_id}",
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

    if uses_quota:
        quotas.backend.record_seer_run(
            group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
        )

    metrics.incr(
        "autofix_feature.trigger",
        tags={
            "referrer": args.referrer.value,
            "step": args.step.value,
            "mode": "single_run" if single_run else "steps",
        },
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
            "stopping_point": stopping_point,
            "single_run": single_run,
            "flush": args.flush,
            "allow_free_cohort": args.allow_free_cohort,
            "has_user_context": args.user_context is not None,
        },
    )

    return run
