from typing import Union

from sentry.snuba.metrics.utils import MetricOperationType, MetricUnit
from sentry.utils.numbers import format_bytes

__all__ = (
    "format_value_using_unit_and_op",
    "format_percentage",
    "format_value_using_unit",
)


def format_percentage(value: Union[int, float], decimal_places: int = 2) -> str:
    if value is None:
        return "\u2014"

    return f"{value:.{decimal_places}f}%"


def format_value_using_unit_and_op(
    value: Union[int, float], unit: MetricUnit, op: MetricOperationType
) -> str:
    if op == "count" or op == "count_unique":
        return str(value)

    return format_value_using_unit(value, unit)


def format_value_using_unit(value: Union[int, float], unit: MetricUnit) -> str:
    if value is None or unit is None:
        return ""

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
    elif unit == "ratio":
        return format_percentage(value, 2)
    elif unit == "percent":
        return format_percentage(value / 100, 2)
    elif unit == "bit":
        return format_bytes(value / 8)
    elif unit == "byte":
        return format_bytes(value)
    elif unit == "kilobyte":
        return format_bytes(value * 1024)
    elif unit == "megabyte":
        return format_bytes(value * 1024**2)
    elif unit == "megabyte":
        return format_bytes(value)
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
    if fixed_digits == 0:
        return int(round(value, 0))

    return round(value, fixed_digits)


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
