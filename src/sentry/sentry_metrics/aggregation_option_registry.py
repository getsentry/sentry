from enum import Enum
from typing import Optional


class AggregationOption(Enum):
    HIST = "hist"


METRIC_ID_AGG_OPTION = {
    "d:transactions/measurements.fcp@millisecond": AggregationOption.HIST,
    "d:transactions/measurements.lcp@millisecond": AggregationOption.HIST,
}


def get_aggregation_option(metricId: str) -> Optional[AggregationOption]:
    return METRIC_ID_AGG_OPTION.get(metricId)
