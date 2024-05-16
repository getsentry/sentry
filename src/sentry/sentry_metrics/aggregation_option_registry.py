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

# Currently there are no default per-use case aggregation overrides
# They are all set via options
USE_CASE_AGG_OPTION = {}


def set_use_case_aggregation_options():
    # As of now this option is still restricted
    # to the scope of the custom use case
    if options.get("sentry-metrics.10s-granularity"):
        USE_CASE_AGG_OPTION[UseCaseID.CUSTOM] = {
            AggregationOption.TEN_SECOND: TimeWindow.SEVEN_DAYS
        }

    for use_case in options.get("sentry-metrics.drop-percentiles.per-use-case"):
        USE_CASE_AGG_OPTION[UseCaseID(use_case)] = {
            AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS
        }


def get_aggregation_options(mri: str, org_id: int) -> dict[AggregationOption, TimeWindow] | None:

    # Set various aggregation options that
    # are use case-wide aggregations
    set_use_case_aggregation_options()

    use_case_id: UseCaseID = extract_use_case_id(mri)

    # We check first if the org ID has disabled percentiles
    if org_id in options.get("sentry-metrics.drop-percentiles.per-org"):
        return {AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS}
    # We then check if the particular metric ID has a specified aggregation
    elif mri in METRIC_ID_AGG_OPTION:
        return METRIC_ID_AGG_OPTION[mri]
    # And move to the use case if not
    elif use_case_id in USE_CASE_AGG_OPTION:
        return USE_CASE_AGG_OPTION[use_case_id]

    return None
