from __future__ import annotations

import logging

import sentry_sdk
from django.utils import timezone

from sentry.investigations.models import Investigation, InvestigationBlockExecution
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def _record_count(name: str, attributes: dict[str, str]) -> None:
    sentry_sdk.metrics.count(name, 1, attributes=attributes)
    metrics.incr(name, tags=attributes, sample_rate=1.0)


def _record_duration(name: str, value: float, attributes: dict[str, str]) -> None:
    sentry_sdk.metrics.distribution(name, value, unit="second", attributes=attributes)
    metrics.distribution(
        name,
        value,
        unit="second",
        tags=attributes,
        sample_rate=1.0,
    )


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
    _record_count("investigations.started", _investigation_attributes(investigation))


def record_investigation_completed(investigation: Investigation) -> None:
    attributes = _investigation_attributes(investigation)
    _record_count("investigations.completed", attributes)
    _record_duration(
        "investigations.duration",
        (timezone.now() - investigation.date_added).total_seconds(),
        attributes,
    )


def record_investigation_failed(investigation: Investigation, *, reason: str) -> None:
    _record_count(
        "investigations.failed",
        {**_investigation_attributes(investigation), "reason": reason},
    )


def record_execution_started(execution: InvestigationBlockExecution) -> None:
    _record_count("investigations.execution.started", _execution_attributes(execution))


def record_execution_completed(execution: InvestigationBlockExecution) -> None:
    attributes = _execution_attributes(execution)
    _record_count("investigations.execution.completed", attributes)
    if execution.completed_at is not None:
        _record_duration(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            {**attributes, "outcome": "completed"},
        )


def record_execution_failed(
    execution: InvestigationBlockExecution, *, reason: str, seer_run_id: int | None
) -> None:
    attributes = _execution_attributes(execution)
    _record_count(
        "investigations.execution.failed",
        {**attributes, "reason": reason},
    )
    if execution.completed_at is not None:
        _record_duration(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            {**attributes, "outcome": "failed"},
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


def record_execution_cancelled(execution: InvestigationBlockExecution, *, reason: str) -> None:
    _record_count(
        "investigations.execution.cancelled",
        {**_execution_attributes(execution), "reason": reason},
    )


def record_title_generation_completed(investigation: Investigation) -> None:
    _record_count(
        "investigations.title_generation.completed", _investigation_attributes(investigation)
    )


def record_title_generation_failed(
    investigation: Investigation, *, reason: str, seer_run_id: int | None
) -> None:
    _record_count(
        "investigations.title_generation.failed",
        {**_investigation_attributes(investigation), "reason": reason},
    )
    record_investigation_failed(investigation, reason=reason)
    logger.warning(
        "investigations.title_generation.failed",
        extra={
            "organization_id": investigation.organization_id,
            "investigation_id": investigation.id,
            "seer_run_id": seer_run_id,
            "reason": reason,
        },
    )
