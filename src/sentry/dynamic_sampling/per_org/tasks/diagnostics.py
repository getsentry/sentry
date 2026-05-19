from __future__ import annotations

import random

from sentry import options

LOGGING_LOCATIONS_OPTION = "dynamic-sampling.per_org.logging-locations"
LOGGING_SAMPLE_RATE_OPTION = "dynamic-sampling.per_org.logging-sample-rate"


def should_log(location: str) -> bool:
    if location not in (options.get(LOGGING_LOCATIONS_OPTION) or []):
        return False

    sample_rate = float(options.get(LOGGING_SAMPLE_RATE_OPTION))
    if sample_rate <= 0.0:
        return False
    if sample_rate >= 1.0:
        return True
    return random.random() < sample_rate
