import datetime
from collections.abc import Callable
from typing import Any

from sentry.utils.dates import parse_stats_period


def map_org_id_param(func: Callable) -> Callable:
    """
    Helper to map organization_id parameter to org_id for backwards compatibility.

    Allows RPC methods to use 'organization_id' while underlying functions use 'org_id'.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> Any:
        kwargs["org_id"] = organization_id
        return func(**kwargs)

    return wrapper


def accept_organization_id_param(func: Callable) -> Callable:
    """
    Helper to accept organization_id parameter.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> Any:
        return func(**kwargs)

    return wrapper


def validate_date_params(
    stats_period: str | None,
    start: str | None,
    end: str | None,
    default_stats_period: str | None = "7d",
    allow_none: bool = False,
) -> tuple[str | None, str | None, str | None]:
    """
    Validate the format and combinations of date params. Raises ValueError.
    On success, returns a tuple of (stats_period, start, end), where either
    - stats_period is valid and start and end are None
    - start and end are valid and stats_period is None
    """
    if not any([bool(stats_period), bool(start), bool(end)]):
        if default_stats_period:
            return default_stats_period, None, None
        elif allow_none:
            return None, None, None
        else:
            raise ValueError("either stats_period or start and end must be provided")

    if start and end:
        start_dt = datetime.datetime.fromisoformat(start)
        end_dt = datetime.datetime.fromisoformat(end)
        if start_dt >= end_dt:
            raise ValueError("start must be before end")
        return None, start, end

    if stats_period:
        if parse_stats_period(stats_period) is None:
            raise ValueError(f"Invalid stats_period: {stats_period}")
        return stats_period, None, None

    raise ValueError("an invalid combination of date params was provided")
