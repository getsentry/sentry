"""Shared runtime gates for the per-org dynamic sampling pipeline.

Both the scheduler (which dispatches work) and the orchestrator (which runs it)
consult the same killswitch, rollout-rate, and metrics-sample-rate options so
that flipping them in production takes effect everywhere without a deploy.
"""

from __future__ import annotations

from sentry import options
from sentry.options.rollout import in_rollout_group

KILLSWITCH_OPTION = "dynamic-sampling.per_org.killswitch"
ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.rollout-rate"
METRICS_SAMPLE_RATE_OPTION = "dynamic-sampling.per_org.metrics-sample-rate"


def is_killswitch_engaged() -> bool:
    return bool(options.get(KILLSWITCH_OPTION))


def rollout_rate() -> float:
    return float(options.get(ROLLOUT_RATE_OPTION))


def is_rollout_enabled() -> bool:
    return rollout_rate() > 0


def is_org_in_rollout(org_id: int) -> bool:
    return in_rollout_group(ROLLOUT_RATE_OPTION, org_id)


def metrics_sample_rate() -> float:
    return float(options.get(METRICS_SAMPLE_RATE_OPTION))
