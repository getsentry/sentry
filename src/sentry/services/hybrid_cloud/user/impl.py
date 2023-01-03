from __future__ import annotations

from typing import Any, Iterable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
    serialize,
)
from sentry.db.models.query import in_iexact
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.user import APIUser, UserSerializeType, UserService


class DatabaseBackedUserService(UserService):
    def get_many_by_email(
        self, emails: List[str], is_active: bool = True, is_verified: bool = True
    ) -> List[APIUser]:
        query = self.__base_user_query()
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

    def serialize_users(
        self,
        user_ids: Optional[List[int]] = None,
        *,
        detailed: UserSerializeType = UserSerializeType.SIMPLE,
        auth_context: AuthenticationContext
        | None = None,  # TODO: replace this with the as_user attribute
        as_user: User | APIUser | None = None,
        # Query filters:
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None,
        emails: Optional[List[str]] = None,
    ) -> List[Any]:
        if auth_context and not as_user:
            as_user = auth_context.user

        serializer = UserSerializer()
        if detailed == UserSerializeType.DETAILED:
            serializer = DetailedUserSerializer()
        if detailed == UserSerializeType.SELF_DETAILED:
            serializer = DetailedSelfUserSerializer()

        query = self.__base_user_query()
        if user_ids is not None:
            query = query.filter(id__in=user_ids)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if organization_id is not None:
            query = query.filter(sentry_orgmember_set__organization_id=organization_id)
        if emails is not None:
            query = query.filter(in_iexact("emails__email", emails))

        return serialize(  # type: ignore
            list(query),
            user=as_user,
            serializer=serializer,
        )

    def get_from_group(self, group: Group) -> List[APIUser]:
        return [
            UserService.serialize_user(u)
            for u in self.__base_user_query().filter(
                sentry_orgmember_set__organization=group.organization,
                sentry_orgmember_set__teams__in=group.project.teams.all(),
                is_active=True,
            )
        ]

    def get_many(self, user_ids: Iterable[int]) -> List[APIUser]:
        query = self.__base_user_query().filter(id__in=user_ids)
        return [UserService.serialize_user(u) for u in query]

    def get_from_project(self, project_id: int) -> List[APIUser]:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return []
        return self.get_many(project.member_set.values_list("user_id", flat=True))

    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[APIUser]:
        return [
            UserService.serialize_user(u)
            for u in self.__base_user_query().filter(actor_id__in=actor_ids)
        ]

    def close(self) -> None:
        pass

    def __base_user_query(self) -> QuerySet:
        return User.objects.select_related("avatar").extra(
            select={
                "permissions": "select array_agg(permission) from sentry_userpermission where user_id=auth_user.id",
                "roles": """
                    SELECT array_agg(permissions)
                    FROM sentry_userrole
                    JOIN sentry_userrole_users
                      ON sentry_userrole_users.role_id=sentry_userrole.id
                   WHERE user_id=auth_user.id""",
            }
        )
