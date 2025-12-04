from collections.abc import Callable
from typing import Any


def map_org_id_param(func: Callable) -> Callable:
    """
    Helper to map organization_id parameter to org_id for backwards compatibility.

    Allows RPC methods to use 'organization_id' while underlying functions use 'org_id'.
    """

    def wrapper(*, organization_id: int, **kwargs: Any) -> Any:
        return func(org_id=organization_id, **kwargs)

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
    default_stats_period: str | None = None,
) -> tuple[str | None, str | None, str | None]:
    """
    Validate that either stats_period or both start and end are provided, but not both. Raises ValueError if the wrong combination is provided.
    Returns the same params, with stats_period = default_stats_period if all params are None.
    Does not validate format (start and end should be ISO strings).
    """
    if not any([bool(stats_period), bool(start), bool(end)]):
        if default_stats_period:
            return default_stats_period, None, None
        else:
            raise ValueError("either stats_period or start and end must be provided")

    if stats_period and (start or end):
        raise ValueError("stats_period and start/end cannot be provided together")

    if not stats_period and not all([bool(start), bool(end)]):
        raise ValueError("start and end must be provided together")

    return stats_period, start, end
