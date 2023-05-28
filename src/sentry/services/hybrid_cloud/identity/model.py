# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from typing_extensions import TypedDict

from sentry.services.hybrid_cloud import RpcModel


class RpcIdentityProvider(RpcModel):
    id: int
    type: str
    external_id: str


class RpcIdentity(RpcModel):
    id: int
    idp_id: int
    user_id: int
    external_id: str


class IdentityFilterArgs(TypedDict, total=False):
    user_id: int
    identity_ext_id: str
    provider_id: int
    provider_ext_id: str
    provider_type: str
