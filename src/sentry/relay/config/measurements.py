""" Relay configuration related to transaction measurements. """


from collections.abc import Sequence
from typing import Literal, TypedDict

#: The maximum number of custom measurements to be extracted from transactions.
CUSTOM_MEASUREMENT_LIMIT = 10

# Relay defines more units than this, but let's keep it simple for now.
# See https://github.com/getsentry/relay/blob/1a7d016f8bc871e8f482611d6a31a01834e678e6/relay-common/src/constants.rs#L600-L627
MeasurementUnit = Literal[
    "millisecond",
    "none",
    "ratio",
]


class BuiltinMeasurementKey(TypedDict):
    name: str
    unit: MeasurementUnit


#: List used to distinguish between user-defined and built-in measurements.
#: NOTE: This is redundant with `ALL_MEASUREMENT_METRICS`, which can be removed
#: once all Relay instances understand the new format.
BUILTIN_MEASUREMENTS: Sequence[BuiltinMeasurementKey] = [
    {"name": "app_start_cold", "unit": "millisecond"},
    {"name": "app_start_warm", "unit": "millisecond"},
    {"name": "cls", "unit": "none"},
    {"name": "fcp", "unit": "millisecond"},
    {"name": "fid", "unit": "millisecond"},
    {"name": "fp", "unit": "millisecond"},
    {"name": "frames_frozen_rate", "unit": "ratio"},
    {"name": "frames_frozen", "unit": "none"},
    {"name": "frames_slow_rate", "unit": "ratio"},
    {"name": "frames_slow", "unit": "none"},
    {"name": "frames_total", "unit": "none"},
    {"name": "inp", "unit": "millisecond"},
    {"name": "lcp", "unit": "millisecond"},
    {"name": "stall_count", "unit": "none"},
    {"name": "stall_longest_time", "unit": "millisecond"},
    {"name": "stall_percentage", "unit": "ratio"},
    {"name": "stall_total_time", "unit": "millisecond"},
    {"name": "ttfb.requesttime", "unit": "millisecond"},
    {"name": "ttfb", "unit": "millisecond"},
    {"name": "time_to_full_display", "unit": "millisecond"},
    {"name": "time_to_initial_display", "unit": "millisecond"},
    {"name": "score.cls", "unit": "ratio"},
    {"name": "score.fcp", "unit": "ratio"},
    {"name": "score.fid", "unit": "ratio"},
    {"name": "score.lcp", "unit": "ratio"},
    {"name": "score.ttfb", "unit": "ratio"},
    {"name": "score.inp", "unit": "ratio"},
    {"name": "score.total", "unit": "ratio"},
    {"name": "score.weight.cls", "unit": "ratio"},
    {"name": "score.weight.fcp", "unit": "ratio"},
    {"name": "score.weight.fid", "unit": "ratio"},
    {"name": "score.weight.lcp", "unit": "ratio"},
    {"name": "score.weight.ttfb", "unit": "ratio"},
    {"name": "score.weight.inp", "unit": "ratio"},
]


class MeasurementsConfig(TypedDict):
    builtinMeasurements: Sequence[BuiltinMeasurementKey]
    maxCustomMeasurements: int


def get_measurements_config() -> MeasurementsConfig:
    return {
        "builtinMeasurements": BUILTIN_MEASUREMENTS,
        "maxCustomMeasurements": CUSTOM_MEASUREMENT_LIMIT,
    }
