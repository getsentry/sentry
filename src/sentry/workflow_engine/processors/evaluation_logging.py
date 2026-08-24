from __future__ import annotations

import random
from logging import Logger
from typing import TYPE_CHECKING

from sentry import features, options
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult

if TYPE_CHECKING:
    from sentry.models.organization import Organization


WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"


def should_log(organization: Organization, result: ProcessWorkflowsResult) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True
    all_workflow_ids = result.evaluations.keys()
    if set(options.get("workflow_engine.evaluation_log_target_workflow_ids")).intersection(
        all_workflow_ids
    ):
        return True
    return random.random() < options.get("workflow_engine.evaluation_log_sample_rate")


def emit_workflow_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    result: ProcessWorkflowsResult,
    log_prefix: str = WORKFLOW_EVALUATION_LOG_PREFIX,
) -> bool:
    """Sample a batch and emit one self-contained artifact per workflow evaluation."""
    if not should_log(organization, result):
        return False

    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    artifacts = (
        [evaluation.to_artifact() for evaluation in result.evaluations.values()]
        if result.evaluations
        else [result.to_artifact()]
    )
    for artifact in artifacts:
        artifact["organization_id"] = organization.id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)

    return True
