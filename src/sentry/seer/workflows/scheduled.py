from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry.cadence.api import ScheduledTriggerType, TriggerContext, register_trigger_action

logger = logging.getLogger(__name__)


# TODO: Enqueue a task per run that creates a cron-sourced run of the SeerWorkflowConfig.
@register_trigger_action(ScheduledTriggerType.SEER_WORKFLOW)
def schedule_workflow_runs(runs: Sequence[TriggerContext]) -> None:
    for run in runs:
        logger.info(
            "seer.workflow.scheduled_run.stub",
            extra={
                "organization_id": run.organization_id,
                "workflow_config_id": run.target_id,
                "scheduled_for": run.scheduled_for.isoformat(),
            },
        )
