from __future__ import annotations

import logging
import random
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import fields, is_dataclass
from typing import TYPE_CHECKING, cast, overload

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.base import (
    BaseWorkflowEngineEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.condition import (
    DataConditionEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.serialization import (
    EvaluationEmitter,
    artifact_fields,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult


DETECTOR_EVALUATION_LOG_PREFIX = "workflow_engine.process_detectors.evaluation"
WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"
ALLOWED_LOG_INPUT_TYPES = (bool, int, float, str)


logger = logging.getLogger(__name__)


def _is_sampled() -> bool:
    sample_rate = cast(float, options.get("workflow_engine.evaluation_log_sample_rate"))
    return random.random() < sample_rate


def should_log(
    organization: Organization,
    result: WorkflowEngineResult,
) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True

    if not isinstance(result, ProcessDetectorsResult):
        target_workflow_ids = cast(
            list[int], options.get("workflow_engine.evaluation_log_target_workflow_ids")
        )
        evaluated_workflow_ids = result.evaluated_workflow_ids()
        if any(workflow_id in evaluated_workflow_ids for workflow_id in target_workflow_ids):
            return True

    return _is_sampled()


class LoggingEmitter(EvaluationEmitter[dict[str, object]]):
    """Logs evaluation artifacts, redacting complex condition inputs."""

    def filter(self, artifact: BaseWorkflowEngineEvaluationArtifact) -> dict[str, object]:
        data = artifact_fields(artifact)
        if isinstance(artifact, DataConditionEvaluationArtifact) and not isinstance(
            artifact.input, ALLOWED_LOG_INPUT_TYPES
        ):
            # Condition input is arbitrary caller data that may contain PII.
            data["input"] = None
        return data

    def emit(
        self,
        organization: Organization,
        result: WorkflowEngineResult,
        evaluations: Iterator[dict[str, object]],
    ) -> None:
        # Evaluations are filtered lazily, so unsampled results skip serialization.
        if not should_log(organization, result):
            return

        direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")

        is_detector_result = isinstance(result, ProcessDetectorsResult)

        log_prefix = (
            DETECTOR_EVALUATION_LOG_PREFIX if is_detector_result else WORKFLOW_EVALUATION_LOG_PREFIX
        )

        for artifact in evaluations:
            artifact["organization_id"] = organization.id

            if direct_to_sentry:
                sdk_logger.info(log_prefix, attributes=artifact)
            else:
                logger.info(log_prefix, extra=artifact)

    @overload
    def serialize[K](self, value: Mapping[K, object]) -> dict[K, object]: ...

    @overload
    def serialize(self, value: object) -> object: ...

    def serialize(self, value: object) -> object:
        """Convert filtered dataclasses to dicts; log attributes otherwise keep their values."""
        if is_dataclass(value) and not isinstance(value, type):
            return {
                field.name: self.serialize(getattr(value, field.name)) for field in fields(value)
            }

        if isinstance(value, Mapping):
            return {key: self.serialize(item) for key, item in value.items()}

        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            return [self.serialize(item) for item in value]

        return value
