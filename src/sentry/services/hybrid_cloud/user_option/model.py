# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, Iterable, List, Optional

from typing_extensions import TypedDict

from sentry.services.hybrid_cloud import RpcModel


class RpcUserOption(RpcModel):
    id: int = -1
    user_id: int = -1
    value: Any = None
    key: str = ""
    project_id: Optional[int] = None
    organization_id: Optional[int] = None


class UserOptionFilterArgs(TypedDict, total=False):
    user_ids: Iterable[int]
    keys: List[str]
    key: str
    project_id: Optional[int]
    organization_id: Optional[int]
