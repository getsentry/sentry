from __future__ import annotations

import random
from dataclasses import asdict
from logging import Logger
from typing import TYPE_CHECKING, cast

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult

if TYPE_CHECKING:
    from sentry.models.organization import Organization


DETECTOR_EVALUATION_LOG_PREFIX = "workflow_engine.process_detectors.evaluation"
WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"


def _is_sampled() -> bool:
    sample_rate = cast(float, options.get("workflow_engine.evaluation_log_sample_rate"))
    return random.random() < sample_rate


def should_log(organization: Organization, result: ProcessWorkflowsResult) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True

    target_workflow_ids = cast(
        list[int], options.get("workflow_engine.evaluation_log_target_workflow_ids")
    )
    if any(workflow_id in result.evaluations for workflow_id in target_workflow_ids):
        return True
    return _is_sampled()


def _emit_evaluation_artifacts(
    logger: Logger,
    *,
    organization_id: int | None,
    artifacts: list[dict[str, object]],
    log_prefix: str,
) -> None:
    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    for artifact in artifacts:
        if organization_id is not None:
            artifact["organization_id"] = organization_id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)


def emit_detector_evaluation_logs(
    logger: Logger,
    *,
    organization_id: int | None,
    result: ProcessDetectorsResult,
    log_prefix: str = DETECTOR_EVALUATION_LOG_PREFIX,
) -> bool:
    if not _is_sampled():
        return False

    _emit_evaluation_artifacts(
        logger,
        organization_id=organization_id,
        artifacts=result.evaluation_artifacts(),
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
    """
    This method is used to log the workflows batched evaluations
    to individual logs, allowing us to easily filter and search for
    a specific workflow's evaluation.
    """
    if not should_log(organization, result):
        return False

    artifacts = (
        [asdict(evaluation.to_artifact()) for evaluation in result.evaluations.values()]
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
