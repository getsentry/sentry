from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.services.hybrid_cloud.identity import APIIdentity, APIIdentityProvider, IdentityService

if TYPE_CHECKING:
    from sentry.models.identity import Identity, IdentityProvider


class DatabaseBackedIdentityService(IdentityService):
    def close(self) -> None:
        pass

    def _serialize_identity(self, identity: Identity) -> APIIdentity:
        return APIIdentity(
            id=identity.id,
            idp_id=identity.idp_id,
            user_id=identity.user_id,
            external_id=identity.external_id,
        )

    def _serialize_identity_provider(
        self, identity_provider: IdentityProvider
    ) -> APIIdentityProvider:
        return APIIdentityProvider(
            id=identity_provider.id,
            type=identity_provider.type,
            external_id=identity_provider.external_id,
        )

    def get_identity_by_provider(self, user_id: int, idp_id: int) -> APIIdentity | None:
        from sentry.models.identity import Identity

        identity = Identity.objects.filter(user_id=user_id, idp_id=idp_id).first()
        if not identity:
            return None

        return self._serialize_identity(identity)

    def get_by_external_ids(
        self, provider_type: str, provider_ext_id: str, identity_ext_id: str
    ) -> APIIdentity | None:
        from sentry.models.identity import Identity

        idp = IdentityProvider.objects.filter(
            type=provider_type, external_id=provider_ext_id
        ).first()
        if not idp:
            return None

        identity = Identity.objects.filter(idp_id=idp.id, external_id=identity_ext_id).first()
        if not identity:
            return None

        return self._serialize_identity(identity)
