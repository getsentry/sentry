import math

from sentry.sentry_metrics.querying.types import ResultValue


def undefined_value_to_none(value: ResultValue) -> ResultValue:
    """
    Converts an undefined value to None or returns the original value.
    """
    if value is None:
        return None

    if is_undefined(value):
        return None

    return value


def is_undefined(value: ResultValue) -> bool:
    """
    Returns whether the result of a query is undefined.
    """
    if value is None:
        return False

    def _is_undefined(inner_value: int | float) -> bool:
        return math.isnan(inner_value) or math.isinf(inner_value)

    if isinstance(value, list):
        return any(map(lambda e: e is not None and _is_undefined(e), value))

    return _is_undefined(value)
