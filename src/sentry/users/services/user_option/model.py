# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, NotRequired, TypedDict

from sentry.hybridcloud.rpc import RpcModel


class RpcUserOption(RpcModel):
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: int | None = None
    organization_id: int | None = None


class UserOptionFilterArgs(TypedDict):
    user_ids: NotRequired[list[int]]
    keys: NotRequired[list[str]]
    key: NotRequired[str]
    project_id: NotRequired[int | None]
    project_ids: NotRequired[list[int] | None]
    organization_id: NotRequired[int | None]
