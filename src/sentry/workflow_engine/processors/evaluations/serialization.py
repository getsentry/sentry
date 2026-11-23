from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import fields
from typing import TYPE_CHECKING, final, overload

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

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class EvaluationEmitter[P: Mapping[str, object]](ABC):
    """
    Emits evaluation artifacts to one destination, such as logs or EAP.

    Destinations store artifact data differently (logs redact condition inputs, EAP stores them),
    so each emitter filters artifacts itself. `send` runs every artifact, including nested ones,
    through `filter` before `serialize` and `emit` see the data, so destinations only receive
    filtered data. When adding or changing an artifact field that holds raw or sensitive data,
    update every emitter's `filter`.
    """

    @final
    def send(self, organization: Organization, result: WorkflowEngineResult) -> None:
        """Filter and serialize the result's evaluations, then emit them to this destination."""
        self.emit(
            organization,
            result,
            (
                self.serialize(self._filter_artifacts(evaluation))
                for evaluation in evaluation_artifacts(result, self.filter)
            ),
        )

    @abstractmethod
    def filter(self, artifact: BaseWorkflowEngineEvaluationArtifact) -> Mapping[str, object]:
        """Return the artifact's fields without data this destination shouldn't store."""
        raise NotImplementedError

    @abstractmethod
    def serialize(self, evaluation: Mapping[str, object]) -> P:
        """Convert a filtered evaluation to this destination's format."""
        raise NotImplementedError

    @abstractmethod
    def emit(
        self,
        organization: Organization,
        result: WorkflowEngineResult,
        evaluations: Iterator[P],
    ) -> None:
        """
        Send serialized evaluations to this emitter's destination. Evaluations are filtered and
        serialized as they're consumed; return without iterating to skip that work entirely.
        """
        raise NotImplementedError

    @overload
    def _filter_artifacts[K](self, value: Mapping[K, object]) -> dict[K, object]: ...

    @overload
    def _filter_artifacts(self, value: object) -> object: ...

    @final
    def _filter_artifacts(self, value: object) -> object:
        """Replace every artifact nested in the value with its filtered fields."""
        if isinstance(value, BaseWorkflowEngineEvaluationArtifact):
            return self._filter_artifacts(self.filter(value))

        if isinstance(value, Mapping):
            return {key: self._filter_artifacts(item) for key, item in value.items()}

        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            return [self._filter_artifacts(item) for item in value]

        return value


def artifact_fields(artifact: BaseWorkflowEngineEvaluationArtifact) -> dict[str, object]:
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
        "project_id": result.project_id,
    }
    if isinstance(result, ProcessWorkflowsResult):
        evaluation.update(
            detector_id=result.detector_id,
            detector_type=result.detector_type,
            event_id=result.event_id,
            group_id=result.group_id,
            outcome=result.outcome,
        )

    return evaluation


def evaluation_artifacts(
    result: WorkflowEngineResult,
    artifact_filter: Callable[[BaseWorkflowEngineEvaluationArtifact], Mapping[str, object]],
) -> Iterator[dict[str, object]]:
    """Yield filtered evaluation artifacts with the shared detector and empty-result context."""
    artifacts = result.evaluation_artifacts()
    if not artifacts:
        yield _empty_evaluation(result)
        return

    for artifact in artifacts:
        serialized = dict(artifact_filter(artifact))
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
