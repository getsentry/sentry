# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, TypedDict

from sentry.hybridcloud.rpc import RpcModel
from social_auth.backends import BaseAuth
from social_auth.utils import get_backend, tokens


class RpcUserSocialAuth(RpcModel):
    id: int
    user_id: int
    provider: str
    uid: str
    extra_data: dict[str, Any]

    def get_backend(self) -> type[BaseAuth] | None:
        return get_backend(instance=self)

    @property
    def tokens(self) -> dict[str, Any]:
        return tokens(instance=self)


class UserSocialAuthFilterArgs(TypedDict, total=False):
    id: int
    user_id: int
    provider: str
    uid: str
