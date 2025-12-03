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
