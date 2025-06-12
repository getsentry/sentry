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
    "d:spans/webvital.inp@millisecond": None,
}

# Currently there are no default per-use case aggregation options
# They are all set via specific overrides, so we removed the global mapping


def get_aggregation_options(mri: str) -> dict[AggregationOption, TimeWindow] | None:

    use_case_id: UseCaseID = extract_use_case_id(mri)

    # We first check if the particular metric ID has a specified aggregation
    if mri in METRIC_ID_AGG_OPTION:
        return METRIC_ID_AGG_OPTION[mri]
    # Then move to use case-level disabled percentiles
    elif use_case_id.value in options.get("sentry-metrics.drop-percentiles.per-use-case"):
        return {AggregationOption.DISABLE_PERCENTILES: TimeWindow.NINETY_DAYS}

    return None
