from collections.abc import Mapping, Sequence
from enum import Enum

from sentry import options
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mri import extract_use_case_id


class AggregationOption(Enum):
    HIST = "hist"
    TEN_SECOND = "ten_second"
    DISABLE_PERCENTILES = "disable_percentiles"


class TimeWindow(Enum):
    SEVEN_DAYS = "7d"
    FOURTEEN_DAYS = "14d"
    THIRTY_DAYS = "30d"
    NINETY_DAYS = "90d"


METRIC_ID_AGG_OPTION = {
    "d:transactions/measurements.fcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
    "d:transactions/measurements.lcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
}

# Currently there are no default per-use case aggregation options
# They are all set via specific overrides, so we removed the global mapping


def get_aggregation_options(mri: str, org_id: int) -> dict[AggregationOption, TimeWindow] | None:

    drop_uc_org_override: Mapping[str, Sequence[int]] = options.get(
        "sentry-metrics.drop-percentiles.per-use-case.with-org-override"
    )
    use_case_id: UseCaseID = extract_use_case_id(mri)
    use_case_agg_options: dict[UseCaseID, dict[AggregationOption, TimeWindow]] = {}

    # As of now this option is still restricted
    # to the scope of the custom use case
    if options.get("sentry-metrics.10s-granularity"):
        use_case_agg_options[UseCaseID.CUSTOM] = {
            AggregationOption.TEN_SECOND: TimeWindow.SEVEN_DAYS
        }

    for use_case in drop_uc_org_override:
        use_case_agg_options[UseCaseID(use_case)] = {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }

    # We check first if the org ID has disabled percentiles
    if org_id in options.get("sentry-metrics.drop-percentiles.per-org"):
        return {AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS}
    # We then check if the particular metric ID has a specified aggregation
    elif mri in METRIC_ID_AGG_OPTION:
        return METRIC_ID_AGG_OPTION[mri]
    # And move to the use case if not
    elif use_case_id in use_case_agg_options:
        if org_id not in drop_uc_org_override.get(use_case_id.value, []):
            return use_case_agg_options[use_case_id]

    return None
