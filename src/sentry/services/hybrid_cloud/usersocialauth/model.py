# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, Dict, TypedDict

from sentry.services.hybrid_cloud import RpcModel


class RpcUserSocialAuth(RpcModel):
    id: int
    user_id: int
    provider: str
    uid: str
    extra_data: Dict[str, Any]


class UserSocialAuthFilterArgs(TypedDict, total=False):
    id: int
    user_id: int
    provider: str
    uid: str
