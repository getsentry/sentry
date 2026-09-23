from __future__ import annotations

import random
from logging import Logger
from typing import TYPE_CHECKING, cast

from sentry import features, options
from sentry.utils import metrics
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluation_eap import (
    get_eap_organization,
    produce_evaluation_artifacts,
)
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.delayed_workflow import (
        DelayedWorkflowEvaluationResult,
    )


DETECTOR_EVALUATION_LOG_PREFIX = "workflow_engine.process_detectors.evaluation"
WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"


def _is_sampled() -> bool:
    sample_rate = cast(float, options.get("workflow_engine.evaluation_log_sample_rate"))
    return random.random() < sample_rate


def should_log(
    organization: Organization,
    result: ProcessWorkflowsResult | DelayedWorkflowEvaluationResult,
) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True

    target_workflow_ids = cast(
        list[int], options.get("workflow_engine.evaluation_log_target_workflow_ids")
    )
    evaluated_workflow_ids = result.evaluated_workflow_ids()
    if any(workflow_id in evaluated_workflow_ids for workflow_id in target_workflow_ids):
        return True
    return _is_sampled()


def redact_evaluation_artifact(artifact: dict[str, object]) -> dict[str, object]:
    """Project an artifact into the existing log format without mutating its inputs."""
    redacted_artifact: dict[str, object] = {}
    for key, value in artifact.items():
        if key == "input":
            redacted_artifact[key] = value if isinstance(value, (bool, int, float, str)) else None
        else:
            redacted_artifact[key] = _redact_log_value(value)
    return redacted_artifact


def _redact_log_value(value: object) -> object:
    if isinstance(value, dict):
        return redact_evaluation_artifact(value)
    if isinstance(value, list):
        return [_redact_log_value(item) for item in value]
    return value


def _emit_evaluation_artifacts(
    *,
    organization: Organization | None,
    artifacts: list[dict[str, object]],
) -> None:
    if organization is not None:
        produce_evaluation_artifacts(organization, artifacts)


def _emit_evaluation_logs(
    logger: Logger,
    *,
    organization_id: int | None,
    artifacts: list[dict[str, object]],
    log_prefix: str,
    should_emit: bool,
) -> bool:
    if not should_emit:
        return False

    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    for full_artifact in artifacts:
        artifact = redact_evaluation_artifact(full_artifact)
        if organization_id is not None:
            artifact["organization_id"] = organization_id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)
    return True


def emit_detector_evaluations(
    logger: Logger,
    *,
    organization_id: int | None,
    result: ProcessDetectorsResult,
    log_prefix: str = DETECTOR_EVALUATION_LOG_PREFIX,
) -> bool:
    should_emit_logs = _is_sampled()
    eap_organization = get_eap_organization(
        organization_id=organization_id, project_id=result.project_id
    )
    if not should_emit_logs and eap_organization is None:
        return False

    try:
        artifacts = result.evaluation_artifacts()
    except Exception:
        metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "artifact"})
        return False

    _emit_evaluation_artifacts(organization=eap_organization, artifacts=artifacts)
    return _emit_evaluation_logs(
        logger,
        organization_id=organization_id,
        artifacts=artifacts,
        log_prefix=log_prefix,
        should_emit=should_emit_logs,
    )


def emit_workflow_evaluations(
    logger: Logger,
    *,
    organization: Organization,
    result: ProcessWorkflowsResult | DelayedWorkflowEvaluationResult,
    log_prefix: str = WORKFLOW_EVALUATION_LOG_PREFIX,
) -> bool:
    """Emit the artifacts and sampled logs for a batch of workflow evaluations."""
    should_emit_logs = should_log(organization, result)
    eap_organization = get_eap_organization(organization=organization)
    if not should_emit_logs and eap_organization is None:
        return False

    try:
        artifacts = result.evaluation_artifacts()
    except Exception:
        metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "artifact"})
        return False

    _emit_evaluation_artifacts(organization=eap_organization, artifacts=artifacts)
    return _emit_evaluation_logs(
        logger,
        organization_id=organization.id,
        artifacts=artifacts,
        log_prefix=log_prefix,
        should_emit=should_emit_logs,
    )
