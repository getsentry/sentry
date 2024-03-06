from enum import Enum

from sentry import options
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, extract_use_case_id


class AggregationOption(Enum):
    HIST = "hist"
    TEN_SECOND = "ten_second"


class TimeWindow(Enum):
    SEVEN_DAYS = "7d"
    FOURTEEN_DAYS = "14d"
    THIRTY_DAYS = "30d"
    NINETY_DAYS = "90d"


METRIC_ID_AGG_OPTION = {
    "d:transactions/measurements.fcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
    "d:transactions/measurements.lcp@millisecond": {AggregationOption.HIST: TimeWindow.NINETY_DAYS},
}

USE_CASE_AGG_OPTION = {UseCaseID.CUSTOM: {AggregationOption.TEN_SECOND: TimeWindow.SEVEN_DAYS}}


def get_aggregation_options(mri: str) -> dict[AggregationOption, TimeWindow] | None:
    use_case_id: UseCaseID = extract_use_case_id(mri)

    # We check first if the particular metric ID has a specified aggregation
    if mri in METRIC_ID_AGG_OPTION:
        return METRIC_ID_AGG_OPTION.get(mri)
    # And move to the use case if not
    elif options.get("sentry-metrics.10s-granularity") and (use_case_id in USE_CASE_AGG_OPTION):
        return USE_CASE_AGG_OPTION[use_case_id]

    return None
