# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from typing import TYPE_CHECKING, Any, TypedDict

from sentry.hybridcloud.rpc import RpcModel

if TYPE_CHECKING:
    from sentry.identity.base import Provider


class RpcIdentityProvider(RpcModel):
    id: int
    type: str
    external_id: str | None


class RpcIdentity(RpcModel):
    id: int
    idp_id: int  # IdentityProvider id
    user_id: int
    external_id: str
    data: dict[str, Any]

    def get_identity(self) -> "Provider":
        from sentry.identity import get
        from sentry.identity.services.identity import identity_service
        from sentry.users.models.identity import IdentityProvider

        identity_provider = identity_service.get_provider(provider_id=self.idp_id)
        if identity_provider is None:
            raise IdentityProvider.DoesNotExist
        return get(identity_provider.type)


class IdentityFilterArgs(TypedDict, total=False):
    id: int
    user_id: int
    identity_ext_id: str
    provider_id: int
    provider_ext_id: str
    provider_type: str
