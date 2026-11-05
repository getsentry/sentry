from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

from django.utils import timezone

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerFiring, register_trigger_action

logger = logging.getLogger(__name__)


# Spread out, since LOG exists to validate scheduling.
@register_trigger_action(ScheduledTriggerType.LOG, spread_window=timedelta(minutes=5))
def log_firings(firings: Sequence[TriggerFiring]) -> None:
    """
    Log each firing. For testing. lag_seconds is from scheduled_for, so includes the
    firing's offset within the LOG spread window; cadence.trigger.dispatch_lag excludes it.
    """
    now = timezone.now()
    for firing in firings:
        logger.info(
            "cadence.log_trigger.fired",
            extra={
                "organization_id": firing.organization_id,
                "target_id": firing.target_id,
                "scheduled_for": firing.scheduled_for.isoformat(),
                "lag_seconds": (now - firing.scheduled_for).total_seconds(),
            },
        )
