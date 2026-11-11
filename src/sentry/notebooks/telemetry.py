from __future__ import annotations

import logging

import sentry_sdk
from django.utils import timezone

from sentry.notebooks.models import Notebook, NotebookActionRequest, NotebookBlockExecution
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def record_count(name: str, attributes: dict[str, str]) -> None:
    sentry_sdk.metrics.count(name, 1, attributes=attributes)
    metrics.incr(name, tags=attributes, sample_rate=1.0)


def record_duration(name: str, value: float, attributes: dict[str, str]) -> None:
    sentry_sdk.metrics.distribution(name, value, unit="second", attributes=attributes)
    metrics.distribution(
        name,
        value,
        unit="second",
        tags=attributes,
        sample_rate=1.0,
    )


def investigation_attributes(investigation: Notebook) -> dict[str, str]:
    return {
        "source_type": str(investigation.source.get("type") or investigation.source_type),
        "template": "manual",
    }


def record_investigation_started(investigation: Notebook) -> None:
    record_count("investigations.started", investigation_attributes(investigation))


def execution_attributes(execution: NotebookBlockExecution) -> dict[str, str]:
    return {
        **investigation_attributes(execution.block.notebook),
        "block_kind": execution.block.kind,
        "executor": execution.executor,
    }


def _action_request_attributes(action_request: NotebookActionRequest) -> dict[str, str]:
    attributes = {"kind": action_request.action_kind or "advice"}
    provider = (action_request.action_payload or {}).get("provider")
    if provider:
        attributes["provider"] = str(provider)
    return attributes


def record_action_request_suggested(action_request: NotebookActionRequest) -> None:
    record_count(
        "investigations.action_request.suggested", _action_request_attributes(action_request)
    )


def record_action_request_applied(action_request: NotebookActionRequest) -> None:
    record_count(
        "investigations.action_request.applied", _action_request_attributes(action_request)
    )


def record_execution_cancelled(execution: NotebookBlockExecution, *, reason: str) -> None:
    record_count(
        "investigations.execution.cancelled",
        {**execution_attributes(execution), "reason": reason},
    )


def record_investigation_completed(investigation: Notebook) -> None:
    attributes = investigation_attributes(investigation)
    record_count("investigations.completed", attributes)
    record_duration(
        "investigations.duration",
        (timezone.now() - investigation.date_added).total_seconds(),
        attributes,
    )


def record_investigation_failed(investigation: Notebook, *, reason: str) -> None:
    record_count(
        "investigations.failed",
        {**investigation_attributes(investigation), "reason": reason},
    )


def record_execution_started(execution: NotebookBlockExecution) -> None:
    record_count("investigations.execution.started", execution_attributes(execution))


def record_execution_completed(execution: NotebookBlockExecution) -> None:
    attributes = execution_attributes(execution)
    record_count("investigations.execution.completed", attributes)
    if execution.completed_at is not None:
        record_duration(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            {**attributes, "outcome": "completed"},
        )


def record_execution_failed(
    execution: NotebookBlockExecution, *, reason: str, seer_run_id: int | None
) -> None:
    attributes = execution_attributes(execution)
    record_count(
        "investigations.execution.failed",
        {**attributes, "reason": reason},
    )
    if execution.completed_at is not None:
        record_duration(
            "investigations.execution.duration",
            (execution.completed_at - execution.date_added).total_seconds(),
            {**attributes, "outcome": "failed"},
        )
    logger.warning(
        "investigations.execution.failed",
        extra={
            "organization_id": execution.block.notebook.organization_id,
            "investigation_id": execution.block.notebook_id,
            "block_id": execution.block_id,
            "execution_id": execution.id,
            "seer_run_id": seer_run_id,
            "reason": reason,
        },
    )


def record_title_generation_completed(investigation: Notebook) -> None:
    record_count(
        "investigations.title_generation.completed", investigation_attributes(investigation)
    )


def record_title_generation_failed(
    investigation: Notebook, *, reason: str, seer_run_id: int | None
) -> None:
    record_count(
        "investigations.title_generation.failed",
        {**investigation_attributes(investigation), "reason": reason},
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
