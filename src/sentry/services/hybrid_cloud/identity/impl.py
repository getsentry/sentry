from __future__ import annotations

from sentry.models.identity import Identity, IdentityProvider
from sentry.services.hybrid_cloud.identity import APIIdentity, APIIdentityProvider, IdentityService


class DatabaseBackedIdentityService(IdentityService):
    def close(self) -> None:
        pass

    def _serialize_identity_provider(
        self, identity_provider: IdentityProvider
    ) -> APIIdentityProvider:
        return APIIdentityProvider(
            type=identity_provider.type, external_id=identity_provider.external_id
        )

    def _serialize_identity(self, identity: Identity) -> APIIdentity:
        return APIIdentity(
            idp_id=identity.idp_id,
            user_id=identity.user_id,
            external_id=identity.external_id,
            data=identity.data,
        )

    def get_by_provider_ids(
        self, provider_type: str, provider_ext_id: str, identity_ext_id: str
    ) -> APIIdentity | None:
        from sentry.models.identity import Identity, IdentityProvider

        idp = IdentityProvider.objects.filter(
            type=provider_type, external_id=provider_ext_id
        ).first()
        if not idp:
            return None

        identity = Identity.objects.filter(idp=idp.id, external_id=identity_ext_id).first()
        if not identity:
            return None

        return self._serialize_identity(identity)
