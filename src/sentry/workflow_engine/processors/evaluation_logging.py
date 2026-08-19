from __future__ import annotations

import random
from logging import Logger
from typing import TYPE_CHECKING, cast

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.workflow import (
    DelayedWorkflowEvaluation,
    ProcessWorkflowsResult,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization


DETECTOR_EVALUATION_LOG_PREFIX = "workflow_engine.process_detectors.evaluation"
WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"
DELAYED_WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_delayed_workflows.evaluation"


def _should_emit_evaluation_logs(organization: Organization) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True
    sample_rate = cast(float, options.get("workflow_engine.evaluation_log_sample_rate"))
    return random.random() < sample_rate


def _emit_evaluation_artifacts(
    logger: Logger,
    *,
    organization_id: int,
    artifacts: list[dict[str, object]],
    log_prefix: str,
) -> None:
    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    for artifact in artifacts:
        artifact["organization_id"] = organization_id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)


def emit_detector_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    result: ProcessDetectorsResult,
    log_prefix: str = DETECTOR_EVALUATION_LOG_PREFIX,
) -> bool:
    """Sample a detector and emit one self-contained artifact per grouped evaluation."""
    if not _should_emit_evaluation_logs(organization):
        return False

    _emit_evaluation_artifacts(
        logger,
        organization_id=organization.id,
        artifacts=result.evaluation_artifacts(),
        log_prefix=log_prefix,
    )
    return True


def emit_delayed_workflow_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    evaluations: list[DelayedWorkflowEvaluation],
    log_prefix: str = DELAYED_WORKFLOW_EVALUATION_LOG_PREFIX,
) -> bool:
    """Sample a delayed batch and emit one self-contained artifact per event evaluation."""
    if not evaluations or not _should_emit_evaluation_logs(organization):
        return False

    _emit_evaluation_artifacts(
        logger,
        organization_id=organization.id,
        artifacts=[evaluation.to_artifact() for evaluation in evaluations],
        log_prefix=log_prefix,
    )
    return True


def emit_workflow_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    result: ProcessWorkflowsResult,
    log_prefix: str = WORKFLOW_EVALUATION_LOG_PREFIX,
) -> bool:
    """Sample a batch and emit one self-contained artifact per workflow evaluation."""
    if not _should_emit_evaluation_logs(organization):
        return False

    artifacts = (
        [evaluation.to_artifact() for evaluation in result.evaluations.values()]
        if result.evaluations
        else [result.to_artifact()]
    )
    _emit_evaluation_artifacts(
        logger,
        organization_id=organization.id,
        artifacts=artifacts,
        log_prefix=log_prefix,
    )
    return True
