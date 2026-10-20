from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry import features
from sentry.workflow_engine.processors.evaluations.eap import emit_evaluation_to_eap
from sentry.workflow_engine.processors.evaluations.logging import emit_evaluation_logs

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult

logger = logging.getLogger(__name__)


def emit_evaluations(
    result: WorkflowEngineResult,
    organization: Organization,
) -> None:
    emit_evaluation_logs(organization, result)

    if features.has("organizations:workflow-engine-evaluation-artifacts-eap", organization):
        try:
            emit_evaluation_to_eap(organization, result)
        except Exception:
            logger.exception(
                "workflow_engine.evaluations.eap.emit_failed",
                extra={"organization_id": organization.id},
            )
