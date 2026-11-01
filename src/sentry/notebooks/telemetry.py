from __future__ import annotations

import sentry_sdk

from sentry.notebooks.models import Notebook, NotebookBlockExecution
from sentry.utils import metrics


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


def execution_attributes(execution: NotebookBlockExecution) -> dict[str, str]:
    return {
        **investigation_attributes(execution.block.notebook),
        "block_kind": execution.block.kind,
        "executor": execution.executor,
    }


def record_execution_cancelled(execution: NotebookBlockExecution, *, reason: str) -> None:
    record_count(
        "investigations.execution.cancelled",
        {**execution_attributes(execution), "reason": reason},
    )
