from typing import TYPE_CHECKING

from sentry import features
from sentry.workflow_engine.processors.evaluations.logging import WorkflowEngineResult

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def emit_evaluations_to_eap(
    organization: Organization,
    result: WorkflowEngineResult,
) -> None:
    if not features.has("organizations:workflow-engine-evaluation-artifacts-eap", organization):
        # The feature is not enabled for the org
        return

    # TODO - emit the artifacts to EAP
    return
