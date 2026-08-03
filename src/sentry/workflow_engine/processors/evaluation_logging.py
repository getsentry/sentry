from __future__ import annotations

import random
from collections.abc import Mapping
from logging import Logger
from typing import TYPE_CHECKING

from sentry_sdk import logger as sentry_logger

from sentry import features, options
from sentry.workflow_engine.processors.evaluations.workflow import WorkflowEvaluation
from sentry.workflow_engine.types import WorkflowId

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def emit_workflow_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    evaluations: Mapping[WorkflowId, WorkflowEvaluation],
) -> bool:
    """Sample a batch and emit one self-contained artifact per workflow evaluation."""
    if not evaluations:
        return False

    should_log = features.has("organizations:workflow-engine-log-evaluations", organization)
    if not should_log:
        should_log = random.random() < options.get("workflow_engine.evaluation_log_sample_rate")

    if not should_log:
        return False

    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    for evaluation in evaluations.values():
        artifact = evaluation.to_artifact()
        log_name = "workflow_engine.process_workflows.evaluation"
        if artifact["triggered_action_ids"]:
            log_name = f"{log_name}.actions.triggered"
        elif evaluation.triggered:
            log_name = f"{log_name}.workflows.triggered"
        else:
            log_name = f"{log_name}.workflows.not_triggered"

        if direct_to_sentry:
            sentry_logger.info(log_name, attributes=artifact)
        else:
            logger.info(log_name, extra=artifact)

    return True
