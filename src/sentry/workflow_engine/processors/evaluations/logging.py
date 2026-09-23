from __future__ import annotations

import logging
import random
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import fields, is_dataclass
from typing import TYPE_CHECKING, cast

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.base import EvaluationPhase, EvaluationType
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult

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


def redact_pii_from_artifact(artifact: dict[str, object]) -> dict[str, object]:
    return cast(dict[str, object], _serialize_log_value(artifact))


def _serialize_log_value(value: object, field_name: str | None = None) -> object:
    """Serialize an artifact value while redacting complex condition inputs."""
    if field_name == "input":
        return value if isinstance(value, ALLOWED_LOG_INPUT_TYPES) else None

    if is_dataclass(value) and not isinstance(value, type):
        return {
            field.name: _serialize_log_value(getattr(value, field.name), field.name)
            for field in fields(value)
        }

    if isinstance(value, Mapping):
        return {key: _serialize_log_value(item, str(key)) for key, item in value.items()}

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_serialize_log_value(item) for item in value]

    return value


def _serialize_empty_result(result: WorkflowEngineResult) -> dict[str, object] | None:
    if isinstance(result, ProcessDetectorsResult):
        return {
            "evaluation_type": EvaluationType.DETECTOR,
            "detector_id": result.detector_id,
            "detector_type": result.detector_type,
            "project_id": result.project_id,
            "outcome": result.outcome,
            "error": result.evaluation_error.msg if result.evaluation_error else None,
        }

    if isinstance(result, ProcessWorkflowsResult):
        return {
            "detector_id": result.detector_id,
            "detector_type": result.detector_type,
            "error": None,
            "evaluation_phase": EvaluationPhase.INITIAL,
            "evaluation_type": EvaluationType.WORKFLOW,
            "event_id": result.event_id,
            "group_id": result.group_id,
            "outcome": result.outcome,
            "project_id": result.project_id,
        }

    return None


def _serialize_evaluation_artifacts(
    result: WorkflowEngineResult,
) -> Iterator[dict[str, object]]:
    artifacts = result.evaluation_artifacts()
    if not artifacts:
        if summary := _serialize_empty_result(result):
            yield summary
        return

    for artifact in artifacts:
        serialized = cast(dict[str, object], _serialize_log_value(artifact))
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


def emit_evaluation_logs(
    organization: Organization,
    result: WorkflowEngineResult,
) -> None:
    if not should_log(organization, result):
        return

    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")

    is_detector_result = isinstance(result, ProcessDetectorsResult)

    log_prefix = (
        DETECTOR_EVALUATION_LOG_PREFIX if is_detector_result else WORKFLOW_EVALUATION_LOG_PREFIX
    )

    for artifact in _serialize_evaluation_artifacts(result):
        artifact["organization_id"] = organization.id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)
