from __future__ import annotations

from typing import Any, Iterable, List

from sentry.api.serializers import (
    DetailedSelfUserSerializer,
    DetailedUserSerializer,
    UserSerializer,
    serialize,
)
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.user import User
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.user import APIUser, UserSerializeType, UserService


class DatabaseBackedUserService(UserService):
    def get_many_by_email(self, email: str) -> List[APIUser]:
        return [
            UserService.serialize_user(user)
            for user in User.objects.filter(
                emails__is_verified=True, is_active=True, emails__email__iexact=email
            )
        ]

    def serialize_users(
        self,
        user_ids: List[int],
        *,
        detailed: UserSerializeType = UserSerializeType.SIMPLE,
        auth_context: AuthenticationContext | None = None,
    ) -> List[Any]:
        api_user = auth_context.user if auth_context else None
        serializer = UserSerializer()
        if detailed == UserSerializeType.DETAILED:
            serializer = DetailedUserSerializer()
        if detailed == UserSerializeType.SELF_DETAILED:
            serializer = DetailedSelfUserSerializer()

        return serialize(  # type: ignore
            list(User.objects.filter(id__in=user_ids)), user=api_user, serializer=serializer
        )

    def get_from_group(self, group: Group) -> List[APIUser]:
        return [
            UserService.serialize_user(u)
            for u in User.objects.filter(
                sentry_orgmember_set__organization=group.organization,
                sentry_orgmember_set__teams__in=group.project.teams.all(),
                is_active=True,
            )
        ]

    def get_many(self, user_ids: Iterable[int]) -> List[APIUser]:
        query = User.objects.filter(id__in=user_ids)
        return [UserService.serialize_user(u) for u in query]

    def get_from_project(self, project_id: int) -> List[APIUser]:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return []
        return self.get_many(project.member_set.values_list("user_id", flat=True))

    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[APIUser]:
        return [UserService.serialize_user(u) for u in User.objects.filter(actor_id__in=actor_ids)]

    def close(self) -> None:
        pass
