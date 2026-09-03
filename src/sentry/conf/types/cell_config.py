from __future__ import annotations

from typing import NotRequired, TypedDict


class CellConfig(TypedDict):
    name: str
    snowflake_id: int
    address: str
    api_gateway_address: NotRequired[str]
    visible: NotRequired[bool]


# Locality is a collection of cells
class LocalityConfig(TypedDict):
    name: str
    category: NotRequired[str]
    """Deprecated and ignored. Visibility is defined via `visible`/`signup_visible`."""
    cells: list[str]
    new_org_cell: str
    visible: NotRequired[bool]
    signup_visible: NotRequired[bool]
