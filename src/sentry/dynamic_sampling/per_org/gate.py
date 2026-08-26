from __future__ import annotations

from sentry import options
from sentry.options.rollout import in_rollout_group

KILLSWITCH_OPTION = "dynamic-sampling.per_org.killswitch"
ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.rollout-rate"
ROLLOUT_ORG_IDS_OPTION = "dynamic-sampling.per_org.rollout-org-ids"
RECALIBRATION_ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.recalibration-rollout-rate"
SERVING_ROLLOUT_RATE_OPTION = "dynamic-sampling.per_org.serving-rollout-rate"
SERVING_ORG_IDS_OPTION = "dynamic-sampling.per_org.serving-org-ids"
METRICS_SAMPLE_RATE_OPTION = "dynamic-sampling.per_org.metrics-sample-rate"
PROJECT_BALANCING_DEBUG_PROJECT_IDS_OPTION = (
    "dynamic-sampling.per_org.project-balancing-debug-project-ids"
)
PROJECT_BALANCING_DEBUG_PROJECT_IDS_LIMIT = 100
TRANSACTION_VOLUME_DEBUG_PROJECT_IDS_OPTION = (
    "dynamic-sampling.per_org.transaction-volume-debug-project-ids"
)
TRANSACTION_VOLUME_DEBUG_PROJECT_IDS_LIMIT = 100
SLIDING_WINDOW_COMPARISON_ORG_IDS_OPTION = (
    "dynamic-sampling.per_org.sliding-window-comparison-org-ids"
)
SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION = (
    "dynamic-sampling.per_org.sample-rates-summary-log-rollout-rate"
)


def _org_ids(option_name: str) -> set[int]:
    return {
        int(org_id)
        for org_id in options.get(option_name)
        if isinstance(org_id, int) or (isinstance(org_id, str) and org_id.isdigit())
    }


def _in_rollout(rate_option: str, org_ids_option: str, org_id: int) -> bool:
    """Whether an organization is selected, by name or by the deterministic % rollout.

    The list is how a single organization is piloted before its rate group exists: it
    only ever adds, so raising the rate keeps every organization already selected.
    """
    return org_id in _org_ids(org_ids_option) or in_rollout_group(rate_option, org_id)


def is_killswitch_engaged() -> bool:
    return bool(options.get(KILLSWITCH_OPTION))


def rollout_rate() -> float:
    return float(options.get(ROLLOUT_RATE_OPTION))


def is_rollout_enabled() -> bool:
    """Whether the pipeline runs at all.

    A listed organization keeps it running at a rate of 0, which is how a pilot starts.
    """
    return rollout_rate() > 0 or bool(_org_ids(ROLLOUT_ORG_IDS_OPTION))


def is_org_in_rollout(org_id: int) -> bool:
    return _in_rollout(ROLLOUT_RATE_OPTION, ROLLOUT_ORG_IDS_OPTION, org_id)


def is_org_in_recalibration_rollout(org_id: int) -> bool:
    return in_rollout_group(RECALIBRATION_ROLLOUT_RATE_OPTION, org_id)


def is_org_in_serving_rollout(org_id: int) -> bool:
    """Whether rule generation reads this organization's sample rates from the per-org caches.

    Independent of the compute rollout, which only decides whether the pipeline fills those
    caches. An organization has to be in both for the per-org caches to hold anything, and
    the killswitch takes precedence over both.
    """
    return not is_killswitch_engaged() and _in_rollout(
        SERVING_ROLLOUT_RATE_OPTION, SERVING_ORG_IDS_OPTION, org_id
    )


def is_org_in_sample_rates_summary_log_rollout(org_id: int) -> bool:
    return in_rollout_group(SAMPLE_RATES_SUMMARY_LOG_ROLLOUT_RATE_OPTION, org_id)


def metrics_sample_rate() -> float:
    return float(options.get(METRICS_SAMPLE_RATE_OPTION))


def project_balancing_debug_project_ids() -> set[int]:
    project_ids: set[int] = set()
    for project_id in options.get(PROJECT_BALANCING_DEBUG_PROJECT_IDS_OPTION)[
        :PROJECT_BALANCING_DEBUG_PROJECT_IDS_LIMIT
    ]:
        if isinstance(project_id, int):
            project_ids.add(project_id)
        elif isinstance(project_id, str) and project_id.isdigit():
            project_ids.add(int(project_id))
    return project_ids


def transaction_volume_debug_project_ids() -> set[int]:
    project_ids: set[int] = set()
    for project_id in options.get(TRANSACTION_VOLUME_DEBUG_PROJECT_IDS_OPTION)[
        :TRANSACTION_VOLUME_DEBUG_PROJECT_IDS_LIMIT
    ]:
        if isinstance(project_id, int):
            project_ids.add(project_id)
        elif isinstance(project_id, str) and project_id.isdigit():
            project_ids.add(int(project_id))
    return project_ids


def sliding_window_comparison_org_ids() -> set[int]:
    return _org_ids(SLIDING_WINDOW_COMPARISON_ORG_IDS_OPTION)
