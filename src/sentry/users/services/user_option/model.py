# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, TypedDict

from sentry.hybridcloud.rpc import RpcModel


class RpcUserOption(RpcModel):
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: int | None = None
    organization_id: int | None = None


class UserOptionFilterArgs(TypedDict, total=False):
    user_ids: list[int]
    keys: list[str]
    key: str
    project_id: int | None
    project_ids: list[int] | None
    organization_id: int | None
