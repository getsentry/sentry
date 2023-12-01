from typing import Optional, Union

from sentry.snuba.metrics.utils import MetricOperationType, MetricUnit
from sentry.utils.numbers import format_bytes

__all__ = (
    "format_value_using_unit_and_op",
    "format_value_using_unit",
)


def format_value_using_unit_and_op(
    value: Union[int, float], unit: MetricUnit, op: Optional[MetricOperationType]
) -> str:
    if op == "count" or op == "count_unique":
        return round_with_fixed(value, 2)

    return format_value_using_unit(value, unit)


def format_value_using_unit(value: Union[int, float], unit: MetricUnit) -> str:
    if unit == "nanosecond":
        return get_duration(value / 1000000000)
    elif unit == "microsecond":
        return get_duration(value / 1000000)
    elif unit == "millisecond":
        return get_duration(value / 1000)
    elif unit == "second":
        return get_duration(value)
    elif unit == "minute":
        return get_duration(value * 60)
    elif unit == "hour":
        return get_duration(value * 60 * 60)
    elif unit == "day":
        return get_duration(value * 60 * 60 * 24)
    elif unit == "week":
        return get_duration(value * 60 * 60 * 24 * 7)
    elif unit == "byte":
        return format_bytes(value)
    elif unit == "kibibyte":
        return format_bytes(value * 1000)
    elif unit == "mebibyte":
        return format_bytes(value * 1000**2)
    elif unit == "gibibyte":
        return format_bytes(value * 1000**3)
    elif unit == "tebibyte":
        return format_bytes(value * 1000**4)
    elif unit == "pebibyte":
        return format_bytes(value * 1000**5)
    elif unit == "exbibyte":
        return format_bytes(value * 1000**6)
    elif unit == "kilobyte":
        return format_bytes(value * 1024)
    elif unit == "megabyte":
        return format_bytes(value * 1024**2)
    elif unit == "gigabyte":
        return format_bytes(value * 1024**3)
    elif unit == "terabyte":
        return format_bytes(value * 1024**4)
    elif unit == "petabyte":
        return format_bytes(value * 1024**5)
    elif unit == "exabyte":
        return format_bytes(value * 1024**6)
    else:
        return str(value)


def round_with_fixed(value, fixed_digits):
    return str(round(value, fixed_digits)).rstrip("0").rstrip(".")


time_units_ms = {
    2629800000: "mo",
    604800000: "wk",
    86400000: "d",
    3600000: "h",
    60000: "m",
    1000: "s",
    1: "ms",
}


def get_duration(seconds, fixed_digits=2):
    abs_value = abs(seconds * 1000)
    ms_value = seconds * 1000

    for duration, unit in time_units_ms.items():
        if abs_value >= duration:
            value = ms_value / duration
            result = round_with_fixed(value, fixed_digits)
            return f"{result} {unit}"

    result = round_with_fixed(ms_value, fixed_digits)
    return f"{result} ms"
