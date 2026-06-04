# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

from pydantic import Field

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
    data: dict[str, Any] = Field(repr=False)

    def get_identity(self) -> "Provider":
        from sentry.identity import get
        from sentry.identity.services.identity import identity_service
        from sentry.users.models.identity import IdentityProvider

        identity_provider = identity_service.get_provider(provider_id=self.idp_id)
        if identity_provider is None:
            raise IdentityProvider.DoesNotExist
        return get(identity_provider.type)


class IdentityFilterArgs(TypedDict):
    id: NotRequired[int]
    user_id: NotRequired[int]
    identity_ext_id: NotRequired[str]
    identity_ext_ids: NotRequired[list[str]]
    provider_id: NotRequired[int]
    provider_ext_id: NotRequired[str]
    provider_type: NotRequired[str]
