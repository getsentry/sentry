from __future__ import annotations

from typing_extensions import NotRequired, TypedDict


class RoleDict(TypedDict):
    id: str
    name: str
    desc: str
    scopes: set[str]
    is_retired: NotRequired[bool]
    is_global: NotRequired[bool]
    is_minimum_role_for: NotRequired[str]
