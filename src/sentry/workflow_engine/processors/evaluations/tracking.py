from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry import features
from sentry.workflow_engine.processors.evaluations.eap import EAPEmitter
from sentry.workflow_engine.processors.evaluations.logging import LoggingEmitter

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult

logger = logging.getLogger(__name__)

_logging_emitter = LoggingEmitter()
_eap_emitter = EAPEmitter()


def emit_evaluations(
    result: WorkflowEngineResult,
    organization: Organization,
) -> None:
    _logging_emitter.send(organization, result)

    if features.has("organizations:workflow-engine-evaluation-artifacts-eap", organization):
        try:
            _eap_emitter.send(organization, result)
        except Exception:
            logger.exception(
                "workflow_engine.evaluations.eap.emit_failed",
                extra={"organization_id": organization.id},
            )
