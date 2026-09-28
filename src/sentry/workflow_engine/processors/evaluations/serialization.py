from __future__ import annotations

from collections.abc import Iterator
from dataclasses import fields

from sentry.workflow_engine.processors.evaluations.base import (
    BaseWorkflowEngineEvaluationArtifact,
    EvaluationType,
)
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult
from sentry.workflow_engine.processors.evaluations.workflow import (
    ProcessWorkflowsResult,
    WorkflowEvaluationOutcome,
)


def _artifact_fields(artifact: BaseWorkflowEngineEvaluationArtifact) -> dict[str, object]:
    return {field.name: getattr(artifact, field.name) for field in fields(artifact)}


def _empty_evaluation(result: WorkflowEngineResult) -> dict[str, object]:
    if isinstance(result, ProcessDetectorsResult):
        return {
            "evaluation_type": EvaluationType.DETECTOR,
            "detector_id": result.detector_id,
            "detector_type": result.detector_type,
            "project_id": result.project_id,
            "outcome": result.outcome,
            "error": result.evaluation_error.msg if result.evaluation_error else None,
        }

    evaluation: dict[str, object] = {
        "error": None,
        "evaluation_phase": result.evaluation_phase,
        "evaluation_type": EvaluationType.WORKFLOW,
        "outcome": WorkflowEvaluationOutcome.NO_WORKFLOWS,
    }
    if isinstance(result, ProcessWorkflowsResult):
        evaluation.update(
            detector_id=result.detector_id,
            detector_type=result.detector_type,
            event_id=result.event_id,
            group_id=result.group_id,
            outcome=result.outcome,
            project_id=result.project_id,
        )

    return evaluation


def evaluation_artifacts(result: WorkflowEngineResult) -> Iterator[dict[str, object]]:
    """Yield evaluation artifacts with the shared detector and empty-result context."""
    artifacts = result.evaluation_artifacts()
    if not artifacts:
        yield _empty_evaluation(result)
        return

    for artifact in artifacts:
        serialized = _artifact_fields(artifact)
        if isinstance(result, ProcessDetectorsResult):
            yield {
                "evaluation_type": EvaluationType.DETECTOR,
                "detector_id": result.detector_id,
                "detector_type": result.detector_type,
                "project_id": result.project_id,
                **serialized,
            }
        else:
            yield serialized
