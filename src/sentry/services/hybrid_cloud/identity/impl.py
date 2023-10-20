from __future__ import annotations

from typing import Any, Callable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.models.authidentity import AuthIdentity
from sentry.models.identity import Identity
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.identity.model import (
    IdentityFilterArgs,
    RpcIdentity,
    RpcIdentityProvider,
)
from sentry.services.hybrid_cloud.identity.serial import (
    serialize_identity,
    serialize_identity_provider,
)
from sentry.services.hybrid_cloud.identity.service import IdentityService


class DatabaseBackedIdentityService(IdentityService):
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

    def get_identities(self, *, filter: IdentityFilterArgs) -> List[RpcIdentity]:
        return self._FQ.get_many(filter=filter)

    def get_identity(self, *, filter: IdentityFilterArgs) -> RpcIdentity | None:
        identities = self.get_identities(filter=filter)
        if len(identities) == 0:
            return None
        return identities[0]

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
        """
        for ai in AuthIdentity.objects.filter(
            user_id=user_id, auth_provider__organization_id=organization_id
        ):
            ai.delete()

    def update_data(self, *, identity_id: int, data: Any) -> Optional[RpcIdentity]:
        identity: Optional[Identity] = Identity.objects.filter(id=identity_id).first()
        if identity is None:
            return None
        identity.update(data=data)
        return serialize_identity(identity)

    class _IdentityFilterQuery(
        FilterQueryDatabaseImpl[Identity, IdentityFilterArgs, RpcIdentity, None]
    ):
        def apply_filters(
            self, query: QuerySet[Identity], filters: IdentityFilterArgs
        ) -> QuerySet[Identity]:
            if "id" in filters:
                query = query.filter(id=filters["id"])
            if "user_id" in filters:
                query = query.filter(user_id=filters["user_id"])
            if "identity_ext_id" in filters:
                query = query.filter(external_id=filters["identity_ext_id"])
            if "provider_id" in filters:
                query = query.filter(idp_id=filters["provider_id"])
            if "provider_ext_id" in filters:
                query = query.filter(idp__external_id=filters["provider_ext_id"])
            if "provider_type" in filters:
                query = query.filter(idp__type=filters["provider_type"])
            return query

        def base_query(self, ids_only: bool = False) -> QuerySet[Identity]:
            return Identity.objects

        def filter_arg_validator(self) -> Callable[[IdentityFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator(*IdentityFilterArgs.__annotations__.keys())

        def serialize_api(self, serializer: Optional[None]) -> Serializer:
            raise NotImplementedError("API Serialization not supported for IdentityService")

        def serialize_rpc(self, identity: Identity) -> RpcIdentity:
            return serialize_identity(identity=identity)

    _FQ = _IdentityFilterQuery()
