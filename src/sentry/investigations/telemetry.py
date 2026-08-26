from __future__ import annotations

import logging

import sentry_sdk
from django.utils import timezone

from sentry.investigations.models import Investigation, InvestigationBlockExecution

logger = logging.getLogger(__name__)


def _investigation_attributes(investigation: Investigation) -> dict[str, str]:
    return {
        "source_type": str(investigation.source.get("type") or investigation.source_type),
        "template": investigation.template_key or "manual",
    }


def _execution_attributes(execution: InvestigationBlockExecution) -> dict[str, str]:
    return {
        **_investigation_attributes(execution.block.investigation),
        "block_kind": execution.block.kind,
        "executor": execution.executor,
    }


def record_investigation_started(investigation: Investigation) -> None:
    sentry_sdk.metrics.count(
        "investigations.started",
        1,
        attributes=_investigation_attributes(investigation),
    )


def record_investigation_completed(investigation: Investigation) -> None:
    attributes = _investigation_attributes(investigation)
    sentry_sdk.metrics.count("investigations.completed", 1, attributes=attributes)
    sentry_sdk.metrics.distribution(
        "investigations.duration",
        (timezone.now() - investigation.date_added).total_seconds(),
        unit="second",
        attributes=attributes,
    )


def record_execution_started(execution: InvestigationBlockExecution) -> None:
    sentry_sdk.metrics.count(
        "investigations.execution.started",
        1,
        attributes=_execution_attributes(execution),
    )


def record_execution_completed(execution: InvestigationBlockExecution) -> None:
    attributes = _execution_attributes(execution)
    sentry_sdk.metrics.count("investigations.execution.completed", 1, attributes=attributes)
    if execution.completed_at is not None:
        sentry_sdk.metrics.distribution(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            unit="second",
            attributes={**attributes, "outcome": "completed"},
        )


def record_execution_failed(
    execution: InvestigationBlockExecution, *, reason: str, seer_run_id: int
) -> None:
    attributes = _execution_attributes(execution)
    sentry_sdk.metrics.count(
        "investigations.execution.failed",
        1,
        attributes={**attributes, "reason": reason},
    )
    if execution.completed_at is not None:
        sentry_sdk.metrics.distribution(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            unit="second",
            attributes={**attributes, "outcome": "failed"},
        )
    logger.warning(
        "investigations.execution.failed",
        extra={
            "organization_id": execution.block.investigation.organization_id,
            "investigation_id": execution.block.investigation_id,
            "block_id": execution.block_id,
            "execution_id": execution.id,
            "seer_run_id": seer_run_id,
            "reason": reason,
        },
    )


def record_title_generation_completed(investigation: Investigation) -> None:
    sentry_sdk.metrics.count(
        "investigations.title_generation.completed",
        1,
        attributes=_investigation_attributes(investigation),
    )


def record_title_generation_failed(
    investigation: Investigation, *, reason: str, seer_run_id: int | None
) -> None:
    sentry_sdk.metrics.count(
        "investigations.title_generation.failed",
        1,
        attributes={**_investigation_attributes(investigation), "reason": reason},
    )
    logger.warning(
        "investigations.title_generation.failed",
        extra={
            "organization_id": investigation.organization_id,
            "investigation_id": investigation.id,
            "seer_run_id": seer_run_id,
            "reason": reason,
        },
    )
