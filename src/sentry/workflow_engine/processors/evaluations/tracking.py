# import logging
# import eap


from sentry import features
from sentry.models.organization import Organization
from sentry.workflow_engine.processors.delayed_workflow import DelayedWorkflowEvaluationResult
from sentry.workflow_engine.processors.evaluations import (
    ProcessDetectorsResult,
    ProcessWorkflowsResult,
)
from sentry.workflow_engine.processors.evaluations.eap import emit_evaluations_to_eap
from sentry.workflow_engine.processors.evaluations.logging import (
    emit_detector_evaluation_logs,
    emit_workflow_evaluation_logs,
)


def emit_evaluations(
    org: Organization,
    result: ProcessWorkflowsResult | DelayedWorkflowEvaluationResult | ProcessDetectorsResult,
):
    is_detector_result = isinstance(result, ProcessDetectorsResult)
    artifacts = result.artifacts

    if is_detector_result:
        emit_detector_evaluation_logs(artifacts)
    else:
        emit_workflow_evaluation_logs(artifacts)

    if features.has("organization:workflow-engine-evaluation-artifacts-eap"):
        emit_evaluations_to_eap(artifacts)
