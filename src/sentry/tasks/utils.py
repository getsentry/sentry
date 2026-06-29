from __future__ import annotations

from datetime import datetime, timedelta

import sentry_sdk
from django.utils import timezone as django_timezone

# These defaults match the statistical detectors hourly run cadence and are
# intentionally kept as module-level constants so callers that share the same
# dispatch rhythm (e.g. seer explorer indexing) can import them directly.
RUN_FREQUENCY = timedelta(hours=1)
DISPATCH_STEP = timedelta(seconds=17)


def compute_delay(
    timestamp: datetime,
    batch_index: int,
    duration: timedelta = RUN_FREQUENCY,
    step: timedelta = DISPATCH_STEP,
) -> int:
    now = django_timezone.now()

    if now - timestamp > duration:
        sentry_sdk.capture_message("Statistical detectors task not dispatched within duration.")

    start = now.replace(minute=0, second=0, microsecond=0)
    end = start + duration

    remaining = end - now.replace(microsecond=0)
    # ensure there is some padding before the end of the duration
    remaining -= step

    return batch_index * int(step.total_seconds()) % int(remaining.total_seconds())
