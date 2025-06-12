from __future__ import annotations

from typing import NotRequired, TypedDict


class RegionConfig(TypedDict):
    name: str
    snowflake_id: int
    address: str
    category: str
    visible: NotRequired[bool]
