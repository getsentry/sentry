""" Relay configuration related to transaction measurements. """


from typing import Sequence, TypedDict

#: The maximum number of custom measurements to be extracted from transactions.
CUSTOM_MEASUREMENT_LIMIT = 5


#: List used to distinguish between user-defined and well-known measurements.
#: NOTE: This is redundant with `ALL_MEASUREMENT_METRICS`, which can be removed
#: once all Relay instances understand the new format.
BUILTIN_MEASUREMENTS = [
    "app_start_cold",
    "app_start_warm",
    "cls",
    "fcp",
    "fid",
    "fp",
    "frames_frozen_rate",
    "frames_frozen",
    "frames_slow_rate",
    "frames_slow",
    "frames_total",
    "lcp",
    "stall_count",
    "stall_longest_time",
    "stall_percentage",
    "stall_total_time",
    "ttfb.requesttime",
    "ttfb",
]

MeasurementName = str


class MeasurementsConfig(TypedDict):
    knownMeasurements: Sequence[MeasurementName]
    maxCustomMeasurements: int


def get_measurements_config() -> MeasurementsConfig:
    return {
        "knownMeasurements": BUILTIN_MEASUREMENTS,
        "maxCustomMeasurements": CUSTOM_MEASUREMENT_LIMIT,
    }
