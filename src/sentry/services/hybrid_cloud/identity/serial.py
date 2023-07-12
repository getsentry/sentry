from typing import TYPE_CHECKING

from sentry.services.hybrid_cloud.identity import RpcIdentity, RpcIdentityProvider

if TYPE_CHECKING:
    from sentry.models.identity import Identity, IdentityProvider


def serialize_identity_provider(identity_provider: "IdentityProvider") -> RpcIdentityProvider:
    return RpcIdentityProvider(
        id=identity_provider.id,
        type=identity_provider.type,
        external_id=identity_provider.external_id,
    )


def serialize_identity(identity: "Identity") -> RpcIdentity:
    return RpcIdentity(
        id=identity.id,
        idp_id=identity.idp_id,
        user_id=identity.user_id,
        external_id=identity.external_id,
        data=identity.data,
    )
