from __future__ import annotations

from typing import NotRequired, TypedDict


class CellConfig(TypedDict):
    name: str
    snowflake_id: int
    address: str
    category: str  # TODO(cells): drop once category is fully moved to LocalityConfig
    visible: NotRequired[bool]


# Locality is a collection of cells
class LocalityConfig(TypedDict):
    name: str
    category: str
    cells: list[str]
    new_org_cell: str
    visible: NotRequired[bool]
