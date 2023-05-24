from __future__ import annotations

from typing import Any, Callable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
)
from sentry.api.serializers.base import Serializer
from sentry.db.models import BaseQuerySet
from sentry.db.models.query import in_iexact
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import (
    FilterQueryDatabaseImpl,
    OpaqueSerializedResponse,
)
from sentry.services.hybrid_cloud.user import (
    RpcUser,
    UserFilterArgs,
    UserSerializeType,
    UserUpdateArgs,
)
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.services.hybrid_cloud.user.service import UserService


class DatabaseBackedUserService(UserService):
    def serialize_many(
        self,
        *,
        filter: UserFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
        serializer: Optional[UserSerializeType] = None,
    ) -> List[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context, serializer)

    def get_many(self, *, filter: UserFilterArgs) -> List[RpcUser]:
        return self._FQ.get_many(filter)

    def get_many_by_email(
        self,
        emails: List[str],
        is_active: bool = True,
        is_verified: bool = True,
        is_project_member: bool = False,
        project_id: Optional[int] = None,
    ) -> List[RpcUser]:
        query = self._FQ.base_query()
        if is_verified:
            query = query.filter(emails__is_verified=is_verified)
        if is_active:
            query = query.filter(is_active=is_active)
        if is_project_member:
            query = query.filter(
                sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id__in=[
                    project_id
                ]
            )
        return [
            self._FQ.serialize_rpc(user)
            for user in query.filter(in_iexact("emails__email", emails))
        ]

    def get_by_username(
        self, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> List[RpcUser]:
        qs = self._FQ.base_query()

        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        if with_valid_password:
            qs = qs.exclude(password="!")

        try:
            # First, assume username is an iexact match for username
            user = qs.get(username__iexact=username)
            return [user]
        except User.DoesNotExist:
            # If not, we can take a stab at guessing it's an email address
            if "@" in username:
                # email isn't guaranteed unique
                return list(qs.filter(email__iexact=username))
        return []

    def flush_nonce(self, *, user_id: int) -> None:
        user = User.objects.filter(id=user_id).first()
        if user is not None:
            user.update(session_nonce="foo")

    def update_user(
        self,
        *,
        user_id: int,
        attrs: UserUpdateArgs,
    ) -> Any:
        if len(attrs):
            User.objects.filter(id=user_id).update(**attrs)
        return self.serialize_many(filter=dict(user_ids=[user_id]))[0]

    def close(self) -> None:
        pass

    class _UserFilterQuery(
        FilterQueryDatabaseImpl[User, UserFilterArgs, RpcUser, UserSerializeType],
    ):
        def apply_filters(
            self,
            query: BaseQuerySet,
            filters: UserFilterArgs,
        ) -> List[User]:
            if "user_ids" in filters:
                query = query.filter(id__in=filters["user_ids"])
            if "is_active" in filters:
                query = query.filter(is_active=filters["is_active"])
            if "organization_id" in filters:
                query = query.filter(
                    sentry_orgmember_set__organization_id=filters["organization_id"]
                )
            if "is_active_memberteam" in filters:
                query = query.filter(
                    sentry_orgmember_set__organizationmemberteam__is_active=filters[
                        "is_active_memberteam"
                    ],
                )
            if "project_ids" in filters:
                query = query.filter(
                    sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id__in=filters[
                        "project_ids"
                    ]
                )
            if "team_ids" in filters:
                query = query.filter(
                    sentry_orgmember_set__organizationmemberteam__team_id__in=filters["team_ids"],
                )
            if "emails" in filters:
                query = query.filter(in_iexact("emails__email", filters["emails"]))

            return list(query)

        def base_query(self) -> QuerySet:
            return User.objects.extra(
                select={
                    "permissions": "select array_agg(permission) from sentry_userpermission where user_id=auth_user.id",
                    "roles": """
                        SELECT array_agg(permissions)
                        FROM sentry_userrole
                        JOIN sentry_userrole_users
                          ON sentry_userrole_users.role_id=sentry_userrole.id
                       WHERE user_id=auth_user.id""",
                    "useremails": "select array_agg(row_to_json(sentry_useremail)) from sentry_useremail where user_id=auth_user.id",
                    "authenticators": "SELECT array_agg(row_to_json(auth_authenticator)) FROM auth_authenticator WHERE user_id=auth_user.id",
                    "useravatar": "SELECT array_agg(row_to_json(sentry_useravatar)) FROM sentry_useravatar WHERE user_id = auth_user.id",
                }
            )

        def filter_arg_validator(self) -> Callable[[UserFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator(
                "user_ids", "organization_id", "team_ids", "project_ids", "emails"
            )

        def serialize_api(self, serializer_type: Optional[UserSerializeType]) -> Serializer:
            serializer: Serializer = UserSerializer()
            if serializer_type == UserSerializeType.DETAILED:
                serializer = DetailedUserSerializer()
            if serializer_type == UserSerializeType.SELF_DETAILED:
                serializer = DetailedSelfUserSerializer()
            return serializer

        def serialize_rpc(self, user: User) -> RpcUser:
            return serialize_rpc_user(user)

    _FQ = _UserFilterQuery()
