from __future__ import annotations

from typing import Any, List

from sentry.models import AuthIdentity
from sentry.services.hybrid_cloud.identity import IdentityService, RpcIdentity, RpcIdentityProvider
from sentry.services.hybrid_cloud.identity.serial import (
    serialize_identity,
    serialize_identity_provider,
)


class DatabaseBackedIdentityService(IdentityService):
    def close(self) -> None:
        pass

    def get_provider(
        self,
        *,
        provider_id: int | None = None,
        provider_type: str | None = None,
        provider_ext_id: str | None = None,
    ) -> RpcIdentityProvider | None:
        from sentry.models.identity import IdentityProvider

        # If an id is provided, use that -- otherwise, use the type and external_id
        idp_kwargs: Any = (
            {"id": provider_id}
            if provider_id
            else {"type": provider_type, "external_id": provider_ext_id}
        )

        idp = IdentityProvider.objects.filter(**idp_kwargs).first()

        return serialize_identity_provider(idp) if idp else None

    def get_identity(
        self,
        *,
        provider_id: int,
        user_id: int | None = None,
        identity_ext_id: str | None = None,
    ) -> RpcIdentity | None:
        from sentry.models.identity import Identity

        # If an user_id is provided, use that -- otherwise, use the external_id
        identity_kwargs: Any = {"user_id": user_id} if user_id else {"external_id": identity_ext_id}

        identity = Identity.objects.filter(**identity_kwargs, idp_id=provider_id).first()

        return serialize_identity(identity) if identity else None

    def get_user_identities_by_provider_type(
        self,
        *,
        user_id: int,
        provider_type: str,
        exclude_matching_external_ids: bool = False,
    ) -> List[RpcIdentity]:
        from django.db.models import F

        from sentry.models.identity import Identity

        identities = Identity.objects.filter(user=user_id, idp__type=provider_type)

        if exclude_matching_external_ids:
            # For Microsoft Teams integration, initially we create rows in the
            # identity table with the external_id as a team_id instead of the user_id.
            # We need to exclude rows where this is NOT updated to the user_id later.
            identities = identities.exclude(external_id=F("idp__external_id"))

        return [serialize_identity(identity) for identity in identities]

    def delete_identities(self, user_id: int, organization_id: int) -> None:
        """
        Deletes the set of identities associated with a user and organization context.
        :param user_id:
        :param organization_id:
        :return:
        """
        AuthIdentity.objects.filter(
            user_id=user_id, auth_provider__organization_id=organization_id
        ).delete()
