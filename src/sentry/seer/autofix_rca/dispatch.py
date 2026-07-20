from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Literal

from sentry import quotas
from sentry.constants import DataCategory
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.autofix_rca.models import FEATURE_ID, AutofixRCAPayload, AutofixRCATweaks
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.seer.autofix.constants import AutofixReferrer
    from sentry.seer.models.run import SeerRun

logger = logging.getLogger(__name__)


def trigger_autofix_rca_feature(
    group: Group,
    *,
    referrer: AutofixReferrer,
    user_context: str | None = None,
    intelligence_level: Literal["low", "medium", "high"] = "medium",
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium",
) -> SeerRun:
    payload = AutofixRCAPayload(
        group_id=group.id,
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        tweaks=AutofixRCATweaks(
            intelligence_level=intelligence_level,
            reasoning_effort=reasoning_effort,
            user_context=user_context,
        ),
    )

    # No category_key/value: for feature runs the authoritative category is set
    # on the Seer side (the autofix_rca feature tags its explorer run as
    # category_key="autofix" so Sentry's autofix drawer finds it). The client-side
    # category is unused by start_feature_run.
    client = SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
    )

    run = client.start_feature_run(
        feature_id=FEATURE_ID,
        payload=payload.dict(),
        title=f"Autofix RCA — {payload.short_id}",
        # flush=True: dispatch inline so seer_run_state_id is populated before we return
        flush=True,
        extras={"group_id": group.id, "referrer": referrer.value},
    )

    # Match trigger_autofix_agent: a new run consumes Seer autofix budget.
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
