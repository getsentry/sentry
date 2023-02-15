from typing import Any, List, Optional

from sentry.services.hybrid_cloud.identity import APIIdentity, APIIdentityProvider, IdentityService


class DatabaseBackedIdentityService(IdentityService):
    def close(self) -> None:
        pass

    def get_provider(
        self,
        *,
        provider_id: Optional[int] = None,
        provider_type: Optional[str] = None,
        provider_ext_id: Optional[str] = None,
    ) -> Optional[APIIdentityProvider]:
        from sentry.models.identity import IdentityProvider

        # If an id is provided, use that -- otherwise, use the type and external_id
        idp_kwargs: Any = (
            {"id": provider_id}
            if provider_id
            else {"type": provider_type, "external_id": provider_ext_id}
        )

        idp = IdentityProvider.objects.filter(**idp_kwargs).first()

        return self._serialize_identity_provider(idp) if idp else None

    def get_identity(
        self,
        *,
        provider_id: int,
        user_id: Optional[int] = None,
        identity_ext_id: Optional[str] = None,
    ) -> Optional[APIIdentity]:
        from sentry.models.identity import Identity

        # If an user_id is provided, use that -- otherwise, use the external_id
        identity_kwargs: Any = {"user_id": user_id} if user_id else {"external_id": identity_ext_id}

        identity = Identity.objects.filter(**identity_kwargs, idp_id=provider_id).first()

        return self._serialize_identity(identity) if identity else None

    def get_user_identities_by_provider_type(
        self,
        *,
        user_id: int,
        provider_type: str,
        exclude_matching_external_ids: bool = False,
    ) -> List[APIIdentity]:
        from django.db.models import F

        from sentry.models.identity import Identity

        identities = Identity.objects.filter(user=user_id, idp__type=provider_type)

        if exclude_matching_external_ids:
            # For Microsoft Teams integration, initially we create rows in the
            # identity table with the external_id as a team_id instead of the user_id.
            # We need to exclude rows where this is NOT updated to the user_id later.
            identities = identities.exclude(external_id=F("idp__external_id"))

        return [self._serialize_identity(identity) for identity in identities]
