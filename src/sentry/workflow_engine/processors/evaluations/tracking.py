from __future__ import annotations

from typing import TYPE_CHECKING

from sentry import features
from sentry.workflow_engine.processors.evaluations.eap import emit_evaluation_to_eap
from sentry.workflow_engine.processors.evaluations.logging import emit_evaluation_logs

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult


def emit_evaluations(
    result: WorkflowEngineResult,
    organization: Organization,
) -> None:
    emit_evaluation_logs(organization, result)

    if features.has("organizations:workflow-engine-evaluation-artifacts-eap", organization):
        emit_evaluation_to_eap(result)
