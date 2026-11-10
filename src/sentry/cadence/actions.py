from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

from django.utils import timezone

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import TriggerFiring, register_trigger_action

logger = logging.getLogger(__name__)


# Spread out, since LOG exists to validate scheduling.
@register_trigger_action(ScheduledTriggerType.LOG, spread_window=timedelta(seconds=30))
def log_firings(firings: Sequence[TriggerFiring]) -> None:
    """
    Log each firing. For testing. seconds_since_scheduled includes the firing's offset
    within the LOG spread window, so it isn't lag; see cadence.trigger.dispatch_lag for that.
    """
    for firing in firings:
        now = timezone.now()
        logger.info(
            "cadence.log_trigger.fired",
            extra={
                "organization_id": firing.organization_id,
                "target_id": firing.target_id,
                "scheduled_for": firing.scheduled_for.isoformat(),
                "fire_at": firing.fire_at.isoformat() if firing.fire_at is not None else None,
                "fired_at": now.isoformat(),
                "seconds_since_scheduled": (now - firing.scheduled_for).total_seconds(),
                "seconds_since_due": (
                    (now - firing.fire_at).total_seconds() if firing.fire_at is not None else None
                ),
            },
        )
