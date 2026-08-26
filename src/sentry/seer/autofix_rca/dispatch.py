from __future__ import annotations

import logging
from typing import Any, Literal

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.group import Group
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.on_completion_hook import extract_hook_definition
from sentry.seer.autofix.autofix_agent import NoSeerQuotaException
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import AutofixStoppingPoint, is_free_cohort_org
from sentry.seer.autofix_rca.models import FEATURE_ID, AutofixRCAPayload, AutofixRCATweaks
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def trigger_autofix_rca_feature(
    group: Group,
    *,
    referrer: AutofixReferrer,
    user_context: str | None = None,
    stopping_point: AutofixStoppingPoint | None = None,
    intelligence_level: Literal["low", "medium", "high"] = "medium",
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium",
    flush: bool = True,
    allow_free_cohort: bool = False,
) -> SeerRun:
    # Free cohort orgs bypass quota only when called from night shift
    # (allow_free_cohort=True). Not exposed via the API.
    skip_quota = allow_free_cohort and is_free_cohort_org(group.organization)
    if not skip_quota:
        has_budget: bool = quotas.backend.check_seer_quota(
            org_id=group.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        if not has_budget:
            raise NoSeerQuotaException()

    payload = AutofixRCAPayload(
        group_id=group.id,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        on_completion_hook=extract_hook_definition(AutofixOnCompletionHook),
        tweaks=AutofixRCATweaks(
            intelligence_level=intelligence_level,
            reasoning_effort=reasoning_effort,
            user_context=user_context,
        ),
    )

    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
    )

    # Store the stopping point here for delivery to use when advancing steps.
    extras: dict[str, Any] = {
        "referrer": referrer.value,
    }
    if stopping_point is not None:
        extras["stopping_point"] = stopping_point.value

    run = client.start_feature_run(
        feature_id=FEATURE_ID,
        payload=payload.dict(),
        title=f"Autofix RCA — {payload.short_id}",
        flush=flush,
        extras=extras,
        referrer=referrer.value,
        force_ce=False,
        force_frontend_code_search=False,
    )

    quotas.backend.record_seer_run(
        group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
    )

    metrics.incr("autofix_rca.feature.trigger", tags={"referrer": referrer.value})

    logger.info(
        "autofix_rca.dispatch.started",
        extra={
            "group_id": group.id,
            "organization_id": group.organization.id,
            "run_id": run.seer_run_state_id,
            "referrer": referrer.value,
        },
    )

    return run
