from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING, cast

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations import (
    ProcessDetectorsResult,
    ProcessWorkflowsResult,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.processors.delayed_workflow import (
        DelayedWorkflowEvaluationResult,
    )


DETECTOR_EVALUATION_LOG_PREFIX = "workflow_engine.process_detectors.evaluation"
WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"

type WorkflowEngineResult = (
    ProcessDetectorsResult | ProcessWorkflowsResult | DelayedWorkflowEvaluationResult
)
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


def emit_evaluation_logs(
    organization: Organization,
    result: WorkflowEngineResult,
) -> None:
    if not should_log(organization, result):
        return

    artifacts = result.evaluation_artifacts()
    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")

    is_detector_result = isinstance(result, ProcessDetectorsResult)

    log_prefix = (
        DETECTOR_EVALUATION_LOG_PREFIX if is_detector_result else WORKFLOW_EVALUATION_LOG_PREFIX
    )

    for artifact in artifacts:
        artifact["organization_id"] = organization.id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)
