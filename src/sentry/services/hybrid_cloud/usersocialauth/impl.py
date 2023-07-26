from typing import Callable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.usersocialauth.model import (
    RpcUserSocialAuth,
    UserSocialAuthFilterArgs,
)
from sentry.services.hybrid_cloud.usersocialauth.serial import serialize_usersocialauth
from sentry.services.hybrid_cloud.usersocialauth.service import UserSocialAuthService
from social_auth.models import UserSocialAuth


class DatabaseBackedUserSocialAuthService(UserSocialAuthService):
    def get_auths(self, *, filter: UserSocialAuthFilterArgs) -> List[RpcUserSocialAuth]:
        return self._FQ.get_many(filter=filter)

    def get_auth(self, *, filter: UserSocialAuthFilterArgs) -> RpcUserSocialAuth | None:
        auths = self.get_auths(filter=filter)
        if len(auths) == 0:
            return None
        return auths[0]

    class _UserSocialAuthFilterQuery(
        FilterQueryDatabaseImpl[UserSocialAuth, UserSocialAuthFilterArgs, RpcUserSocialAuth, None]
    ):
        def apply_filters(self, query: QuerySet, filters: UserSocialAuthFilterArgs) -> QuerySet:
            if "id" in filters:
                query = query.filter(id=filters["id"])
            if "user_id" in filters:
                query = query.filter(user_id=filters["user_id"])
            if "provider" in filters:
                query = query.filter(provider=filters["provider"])
            if "uid" in filters:
                query = query.filter(uid=filters["uid"])
            return query

        def base_query(self, ids_only: bool = False) -> QuerySet:
            return UserSocialAuth.objects

        def filter_arg_validator(self) -> Callable[[UserSocialAuthFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator(
                *UserSocialAuthFilterArgs.__annotations__.keys()
            )

        def serialize_api(self, serializer: Optional[None]) -> Serializer:
            raise NotImplementedError("API Serialization not supported for UserSocialAuthService")

        def serialize_rpc(self, auth: UserSocialAuth) -> RpcUserSocialAuth:
            return serialize_usersocialauth(auth=auth)

    _FQ = _UserSocialAuthFilterQuery()
