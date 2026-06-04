# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from collections.abc import Callable

import sentry_sdk
from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.hybridcloud.rpc.filter_query import FilterQueryDatabaseImpl
from sentry.integrations.models.integration import Integration
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.users.services.usersocialauth.model import RpcUserSocialAuth, UserSocialAuthFilterArgs
from sentry.users.services.usersocialauth.serial import serialize_usersocialauth
from sentry.users.services.usersocialauth.service import UserSocialAuthService
from social_auth.models import UserSocialAuth


class DatabaseBackedUserSocialAuthService(UserSocialAuthService):
    def get_many(self, *, filter: UserSocialAuthFilterArgs) -> list[RpcUserSocialAuth]:
        return self._FQ.get_many(filter=filter)

    def get_one_or_none(self, *, filter: UserSocialAuthFilterArgs) -> RpcUserSocialAuth | None:
        auths = self.get_many(filter=filter)
        if len(auths) == 0:
            return None
        return auths[0]

    def revoke_token(
        self, *, filter: UserSocialAuthFilterArgs, drop_token: bool = True
    ) -> list[RpcUserSocialAuth]:
        """
        Calls UserSocialAuth.revoke_token() on all matching results, returning the modified RpcUserSocialAuths.
        """
        db_auths = self._FQ.query_many(filter=filter)
        for db_auth in db_auths:
            db_auth.revoke_token(drop_token=drop_token)
        return self.get_many(filter=filter)

    def refresh_token(self, *, filter: UserSocialAuthFilterArgs) -> list[RpcUserSocialAuth]:
        """
        Calls UserSocialAuth.refresh_token() on all matching results, returning the modified RpcUserSocialAuths.
        """
        db_auths = self._FQ.query_many(filter=filter)
        for db_auth in db_auths:
            db_auth.refresh_token()
        return self.get_many(filter=filter)

    def link_auth(self, *, usa: RpcUserSocialAuth, organization: RpcOrganization) -> bool:
        try:
            integration, _created = Integration.objects.get_or_create(
                provider=usa.provider, external_id=usa.uid
            )
            integration.add_organization(organization, None, default_auth_id=usa.id)
        except Exception as error:
            sentry_sdk.capture_exception(error=error)
            return False
        return True

    class _UserSocialAuthFilterQuery(
        FilterQueryDatabaseImpl[UserSocialAuth, UserSocialAuthFilterArgs, RpcUserSocialAuth, None]
    ):
        def apply_filters(
            self, query: QuerySet[UserSocialAuth], filters: UserSocialAuthFilterArgs
        ) -> QuerySet[UserSocialAuth]:
            if "id" in filters:
                query = query.filter(id=filters["id"])
            if "user_id" in filters:
                query = query.filter(user_id=filters["user_id"])
            if "provider" in filters:
                query = query.filter(provider=filters["provider"])
            if "uid" in filters:
                query = query.filter(uid=filters["uid"])
            return query

        def base_query(self, select_related: bool = True) -> QuerySet[UserSocialAuth]:
            return UserSocialAuth.objects.filter()

        def filter_arg_validator(self) -> Callable[[UserSocialAuthFilterArgs], str | None]:
            return self._filter_has_any_key_validator(
                *UserSocialAuthFilterArgs.__annotations__.keys()
            )

        def serialize_api(self, serializer: None) -> Serializer:
            raise NotImplementedError("API Serialization not supported for UserSocialAuthService")

        def serialize_rpc(self, auth: UserSocialAuth) -> RpcUserSocialAuth:
            return serialize_usersocialauth(auth=auth)

    _FQ = _UserSocialAuthFilterQuery()
