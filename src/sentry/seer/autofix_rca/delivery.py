from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import sentry_sdk
from django.db import router, transaction

from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix_rca.models import FEATURE_ID, LEGACY_FEATURE_ID
from sentry.seer.models.run import SeerAgentRun

logger = logging.getLogger(__name__)


def deliver_autofix_rca_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
) -> None:
    logger.info(
        "autofix_rca.delivery.received",
        extra={"organization_id": organization_id, "run_uuid": run_uuid, "status": status},
    )
    using = router.db_for_write(SeerAgentRun)
    with transaction.atomic(using=using):
        agent_run = (
            SeerAgentRun.objects.using(using)
            .select_for_update()
            .filter(
                run__uuid=run_uuid,
                run__organization_id=organization_id,
                source__in=(FEATURE_ID, LEGACY_FEATURE_ID),
            )
            .select_related("run", "run__organization")
            .first()
        )
        if agent_run is None:
            logger.warning(
                "autofix_rca.delivery.missing_run",
                extra={"organization_id": organization_id, "run_uuid": run_uuid},
            )
            return

        run_state_id = agent_run.run.seer_run_state_id
        log_extra: dict[str, object] = {
            "organization_id": organization_id,
            "run_uuid": run_uuid,
            "seer_run_id": run_state_id,
            "group_id": agent_run.group_id,
        }
        extras = dict(agent_run.extras or {})

        if extras.get("status") == "completed":
            sentry_sdk.metrics.count(
                "autofix_rca.delivery_error", 1, attributes={"error_type": "duplicate"}
            )
            logger.warning("autofix_rca.delivery.already_delivered", extra=log_extra)
            return

        if status == "error" or result is None:
            sentry_sdk.metrics.count(
                "autofix_rca.delivery_error",
                1,
                attributes={"error_type": "delivery_error" if status == "error" else "no_result"},
            )
            agent_run.update(
                using=using,
                extras={**extras, "status": "error", "error_message": error},
            )
            logger.warning("autofix_rca.delivery.no_result", extra={**log_extra, "status": status})
            return

        # Persist and claim the result before triggering non-idempotent downstream actions.
        extras.pop("error_message", None)
        agent_run.update(
            using=using,
            extras={**extras, "status": "completed", "result": result},
        )

        group_id = agent_run.group_id
        organization = agent_run.run.organization

    if group_id is None or run_state_id is None:
        logger.warning("autofix_rca.delivery.cannot_surface", extra=log_extra)
        return

    AutofixOnCompletionHook.execute(organization, run_state_id)

    sentry_sdk.metrics.count("autofix_rca.delivery_completed", 1)
    logger.info("autofix_rca.delivery.completed", extra=log_extra)
