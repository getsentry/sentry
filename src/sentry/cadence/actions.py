from __future__ import annotations

import logging
from collections.abc import Sequence

from django.utils import timezone

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerContext, register_trigger_action

logger = logging.getLogger(__name__)


@register_trigger_action(ScheduledTriggerType.LOG)
def log_runs(runs: Sequence[TriggerContext]) -> None:
    """Log each run. For testing."""
    now = timezone.now()
    for run in runs:
        logger.info(
            "cadence.log_trigger.run",
            extra={
                "organization_id": run.organization_id,
                "target_id": run.target_id,
                "scheduled_for": run.scheduled_for.isoformat(),
                "lag_seconds": (now - run.scheduled_for).total_seconds(),
            },
        )
