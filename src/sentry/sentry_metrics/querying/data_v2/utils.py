import math

from sentry.sentry_metrics.querying.types import ResultValue


def get_identity(value: ResultValue) -> ResultValue:
    """
    Computes the identity of a value.

    For nan, we want to return None instead of 0.0 but this is just a design decision that conforms
    to the previous implementation of the layer.
    """
    if value is None:
        return None

    if is_nan(value):
        return None

    # We might decide in the future to have identity values specific to each aggregate.
    return type(value)()


def nan_to_none(value: ResultValue) -> ResultValue:
    """
    Converts a nan value to None or returns the original value.
    """
    if value is None:
        return None

    if is_nan(value):
        return None

    return value


def is_nan(value: ResultValue) -> bool:
    """
    Returns whether the result of a query is nan.
    """
    if value is None:
        return False
    elif isinstance(value, list):
        return any(map(lambda e: e is not None and math.isnan(e), value))

    return math.isnan(value)
