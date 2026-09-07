from __future__ import annotations

from sentry import options
from sentry.options.rollout import in_rollout_group

KILLSWITCH_OPTION = "dynamic-sampling.per_org.killswitch"
METRICS_SAMPLE_RATE_OPTION = "dynamic-sampling.per_org.metrics-sample-rate"
SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION = (
    "dynamic-sampling.per_org.sample-rates-summary-log-rollout-rate"
)


def is_killswitch_engaged() -> bool:
    return bool(options.get(KILLSWITCH_OPTION))


def is_org_in_sample_rates_summary_log_rollout(org_id: int) -> bool:
    return in_rollout_group(SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION, org_id)


def metrics_sample_rate() -> float:
    return float(options.get(METRICS_SAMPLE_RATE_OPTION))
