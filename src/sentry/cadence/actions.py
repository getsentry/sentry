from __future__ import annotations

import logging
from collections.abc import Collection, Sequence
from datetime import timedelta

from django.utils import timezone

from sentry.cadence.models import ScheduledTriggerType
from sentry.cadence.registry import (
    TriggerFiring,
    TriggerHandler,
    TriggerTarget,
    register_trigger_type,
)

logger = logging.getLogger(__name__)


@register_trigger_type(ScheduledTriggerType.LOG)
class LogTriggerHandler(TriggerHandler):
    # Spread out, since LOG exists to validate scheduling.
    spread_window = timedelta(seconds=30)

    def dispatch(self, firings: Sequence[TriggerFiring]) -> None:
        """
        Log each firing. For testing. seconds_since_scheduled includes the firing's offset
        within the LOG spread window, so it isn't lag; see cadence.trigger.dispatch_lag for
        that.
        """
        now = timezone.now()
        for firing in firings:
            logger.info(
                "cadence.log_trigger.fired",
                extra={
                    "organization_id": firing.organization_id,
                    "target_id": firing.target_id,
                    "scheduled_for": firing.scheduled_for.isoformat(),
                    "seconds_since_scheduled": (now - firing.scheduled_for).total_seconds(),
                },
            )

    def find_missing(self, targets: Sequence[TriggerTarget]) -> Collection[TriggerTarget]:
        # Target ids are arbitrary ids chosen by the caller, so none are ever missing.
        return ()
