from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry.cadence.api import ScheduledTriggerType, TriggerFiring, register_trigger_action

logger = logging.getLogger(__name__)


# TODO: Enqueue a task per firing that creates a cron-sourced run of the SeerWorkflowConfig.
@register_trigger_action(ScheduledTriggerType.SEER_WORKFLOW)
def schedule_workflow_runs(firings: Sequence[TriggerFiring]) -> None:
    for firing in firings:
        logger.info(
            "seer.workflow.scheduled_run.stub",
            extra={
                "organization_id": firing.organization_id,
                "workflow_config_id": firing.target_id,
                "scheduled_for": firing.scheduled_for.isoformat(),
            },
        )
