from __future__ import annotations

import logging
from datetime import datetime

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import register_trigger_action

logger = logging.getLogger(__name__)


@register_trigger_action(ScheduledTriggerType.TRIAGE)
def run_triage(trigger_id: int, scheduled_for: datetime) -> None:
    logger.info(
        "pretend I'm scheduling a task with :",
        extra={
            "trigger_type": ScheduledTriggerType.TRIAGE,
            "trigger_id": trigger_id,
            "scheduled_for": scheduled_for.isoformat(),
        },
    )


@register_trigger_action(ScheduledTriggerType.AUTOMATION)
def run_automation(trigger_id: int, scheduled_for: datetime) -> None:
    logger.info(
        "pretend I'm scheduling a task with :",
        extra={
            "trigger_type": ScheduledTriggerType.AUTOMATION,
            "trigger_id": trigger_id,
            "scheduled_for": scheduled_for.isoformat(),
        },
    )
