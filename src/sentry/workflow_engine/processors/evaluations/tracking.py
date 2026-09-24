from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.workflow_engine.processors.evaluations.logging import (
    WorkflowEngineResult,
    emit_evaluation_logs,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def emit_evaluations(
    result: WorkflowEngineResult,
    organization: Organization,
) -> None:
    emit_evaluation_logs(organization, result)
    # TODO - emit_evaluation_to_eap(organization, result)
