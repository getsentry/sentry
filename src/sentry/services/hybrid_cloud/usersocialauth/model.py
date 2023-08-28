# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, Dict

from typing_extensions import TypedDict

from sentry.services.hybrid_cloud import RpcModel
from social_auth.utils import expiration_datetime, get_backend, tokens


class RpcUserSocialAuth(RpcModel):
    id: int
    user_id: int
    provider: str
    uid: str
    extra_data: Dict[str, Any]

    def get_backend(self):
        return get_backend(instance=self)

    @property
    def tokens(self):
        return tokens(instance=self)

    def expiration_datetime(self):
        return expiration_datetime(instance=self)


class UserSocialAuthFilterArgs(TypedDict, total=False):
    id: int
    user_id: int
    provider: str
    uid: str
