from __future__ import annotations

from typing import Any, Callable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
    serialize,
)
from sentry.db.models import BaseQuerySet
from sentry.db.models.query import in_iexact
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.user import (
    APIUser,
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
            UserService.serialize_user(user)
            for user in query.filter(in_iexact("emails__email", emails))
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

    # TODO: replace this with serialize_many. Only piece missing is auth_context
    def serialize_users(
        self,
        *,
        detailed: UserSerializeType = UserSerializeType.SIMPLE,
        auth_context: AuthenticationContext
        | None = None,  # Note that 'as_user' does not pass `is_super_user(env.request)` calls, where as this does.
        as_user: User | APIUser | None = None,
        # Query filters:
        user_ids: Optional[List[int]] = None,
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None,
        project_ids: Optional[List[int]] = None,
        team_ids: Optional[List[int]] = None,
        is_active_memberteam: Optional[bool] = None,
        emails: Optional[List[str]] = None,
    ) -> List[Any]:
        if auth_context and not as_user:
            as_user = auth_context.user

        serializer = UserSerializer()
        if detailed == UserSerializeType.DETAILED:
            serializer = DetailedUserSerializer()
        if detailed == UserSerializeType.SELF_DETAILED:
            serializer = DetailedSelfUserSerializer()

        users = self.query_users(
            user_ids=user_ids,
            is_active=is_active,
            organization_id=organization_id,
            project_ids=project_ids,
            is_active_memberteam=is_active_memberteam,
            emails=emails,
        )

        return serialize(  # type: ignore
            users,
            user=as_user,
            serializer=serializer,
        )

    def get_from_group(self, group: Group) -> List[APIUser]:
        return [
            UserService.serialize_user(u)
            for u in self._base_query().filter(
                sentry_orgmember_set__organization=group.organization,
                sentry_orgmember_set__teams__in=group.project.teams.all(),
                is_active=True,
            )
        ]

    # def get_many(self, user_ids: Iterable[int]) -> List[APIUser]:
    #     query = self._base_query().filter(id__in=user_ids)
    #     return [UserService.serialize_user(u) for u in query]

    def get_from_project(self, project_id: int) -> List[APIUser]:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return []
        return self.get_many(
            filter=dict(user_ids=project.member_set.values_list("user_id", flat=True))
        )

    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[APIUser]:
        return [
            UserService.serialize_user(u) for u in self._base_query().filter(actor_id__in=actor_ids)
        ]

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

    def _rpc_serialize_object(self, user: User) -> APIUser:
        return self.serialize_user(user)
