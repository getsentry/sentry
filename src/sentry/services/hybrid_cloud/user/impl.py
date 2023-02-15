from __future__ import annotations

from dataclasses import fields
from typing import Any, Callable, FrozenSet, Iterable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
)
from sentry.api.serializers.base import Serializer
from sentry.db.models import BaseQuerySet
from sentry.db.models.query import in_iexact
from sentry.models.group import Group
from sentry.models.user import User
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.user import (
    APIAvatar,
    APIUser,
    APIUserEmail,
    UserFilterArgs,
    UserSerializeType,
    UserService,
)


class DatabaseBackedUserService(
    FilterQueryDatabaseImpl[User, UserFilterArgs, APIUser, UserSerializeType],
    UserService,
):
    def get_many_by_email(
        self, emails: List[str], is_active: bool = True, is_verified: bool = True
    ) -> List[APIUser]:
        query = self._base_query()
        if is_verified:
            query = query.filter(emails__is_verified=is_verified)
        if is_active:
            query = query.filter(is_active=is_active)
        return [
            self._serialize_rpc(user) for user in query.filter(in_iexact("emails__email", emails))
        ]

    def get_by_username(
        self, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> List[APIUser]:
        qs = User.objects

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

    def _apply_filters(
        self,
        query: BaseQuerySet,
        filters: UserFilterArgs,
    ) -> List[User]:
        query = self._base_query()
        if "user_ids" in filters:
            query = query.filter(id__in=filters["user_ids"])
        if "is_active" in filters:
            query = query.filter(is_active=filters["is_active"])
        if "organization_id" in filters:
            query = query.filter(sentry_orgmember_set__organization_id=filters["organization_id"])
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

    def get_from_group(self, group: Group) -> List[APIUser]:
        return [
            self._serialize_rpc(u)
            for u in self._base_query().filter(
                sentry_orgmember_set__organization=group.organization,
                sentry_orgmember_set__teams__in=group.project.teams.all(),
                is_active=True,
            )
        ]

    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[APIUser]:
        return [self._serialize_rpc(u) for u in self._base_query().filter(actor_id__in=actor_ids)]

    def close(self) -> None:
        pass

    def _base_query(self) -> QuerySet:
        return User.objects.select_related("avatar").extra(
            select={
                "permissions": "select array_agg(permission) from sentry_userpermission where user_id=auth_user.id",
                "roles": """
                    SELECT array_agg(permissions)
                    FROM sentry_userrole
                    JOIN sentry_userrole_users
                      ON sentry_userrole_users.role_id=sentry_userrole.id
                   WHERE user_id=auth_user.id""",
                "useremails": "select array_agg(row_to_json(sentry_useremail)) from sentry_useremail where user_id=auth_user.id",
            }
        )

    def _filter_arg_validator(self) -> Callable[[UserFilterArgs], Optional[str]]:
        return self._filter_has_any_key_validator(
            "user_ids", "organization_id", "team_ids", "project_ids", "emails"
        )

    def _serialize_api(self, serializer_type: Optional[UserSerializeType]) -> Serializer:
        serializer: Serializer = UserSerializer()
        if serializer_type == UserSerializeType.DETAILED:
            serializer = DetailedUserSerializer()
        if serializer_type == UserSerializeType.SELF_DETAILED:
            serializer = DetailedSelfUserSerializer()
        return serializer

    def _serialize_rpc(self, user: User) -> APIUser:
        return serialize_rpc_user(user)


def serialize_rpc_user(user: User) -> APIUser:
    args = {
        field.name: getattr(user, field.name)
        for field in fields(APIUser)
        if hasattr(user, field.name)
    }
    args["pk"] = user.pk
    args["display_name"] = user.get_display_name()
    args["label"] = user.get_label()
    args["is_superuser"] = user.is_superuser
    args["is_sentry_app"] = user.is_sentry_app
    args["password_usable"] = user.has_usable_password()
    args["emails"] = frozenset([email.email for email in user.get_verified_emails()])

    # And process the _base_user_query special data additions
    permissions: FrozenSet[str] = frozenset({})
    if hasattr(user, "permissions") and user.permissions is not None:
        permissions = frozenset(user.permissions)
    args["permissions"] = permissions

    roles: FrozenSet[str] = frozenset({})
    if hasattr(user, "roles") and user.roles is not None:
        roles = frozenset(flatten(user.roles))
    args["roles"] = roles

    useremails: FrozenSet[APIUserEmail] = frozenset({})
    if hasattr(user, "useremails") and user.useremails is not None:
        useremails = frozenset(
            {
                APIUserEmail(
                    id=e["id"],
                    email=e["email"],
                    is_verified=e["is_verified"],
                )
                for e in user.useremails
            }
        )
    args["useremails"] = useremails
    avatar = user.avatar.first()
    if avatar is not None:
        avatar = APIAvatar(
            id=avatar.id,
            file_id=avatar.file_id,
            ident=avatar.ident,
            avatar_type=avatar.avatar_type,
        )
    args["avatar"] = avatar
    return APIUser(**args)


def flatten(iter: Iterable[Any]) -> List[Any]:
    return (
        ((flatten(iter[0]) + flatten(iter[1:])) if len(iter) > 0 else [])
        if type(iter) is list or isinstance(iter, BaseQuerySet)
        else [iter]
    )
