from __future__ import annotations

from sentry import options
from sentry.options.rollout import in_rollout_group

KILLSWITCH_OPTION = "dynamic-sampling.per_org.killswitch"
ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.rollout-rate"
SERVING_ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.serving-rollout-rate"
SERVING_ORG_IDS_OPTION = "dynamic-sampling.per_org.serving-org-ids"
METRICS_SAMPLE_RATE_OPTION = "dynamic-sampling.per_org.metrics-sample-rate"


def _org_ids(option_name: str) -> set[int]:
    return {
        int(org_id)
        for org_id in options.get(option_name)
        if isinstance(org_id, int) or (isinstance(org_id, str) and org_id.isdigit())
    }


def is_killswitch_engaged() -> bool:
    return bool(options.get(KILLSWITCH_OPTION))


def rollout_rate() -> float:
    return float(options.get(ROLLOUT_RATE_OPTION))


def is_rollout_enabled() -> bool:
    return rollout_rate() > 0


def is_org_in_rollout(org_id: int) -> bool:
    return in_rollout_group(ROLLOUT_RATE_OPTION, org_id)


def is_org_in_serving_rollout(org_id: int) -> bool:
    if is_killswitch_engaged():
        return False
    return org_id in _org_ids(SERVING_ORG_IDS_OPTION) or in_rollout_group(
        SERVING_ROLLOUT_RATE_OPTION, org_id
    )


def metrics_sample_rate() -> float:
    return float(options.get(METRICS_SAMPLE_RATE_OPTION))
