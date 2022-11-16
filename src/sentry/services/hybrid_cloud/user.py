from abc import abstractmethod
from dataclasses import dataclass, fields
from typing import Any, Iterable, List, Optional

from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.user import User
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass(frozen=True, eq=True)
class APIUser:
    id: int = -1
    pk: int = -1
    name: str = ""
    email: str = ""
    username: str = ""
    actor_id: int = -1
    display_name: str = ""
    is_superuser: bool = False
    is_authenticated: bool = False
    is_anonymous: bool = False
    is_active: bool = False

    def get_display_name(self) -> str:  # API compatibility with ORM User
        return self.display_name

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.username

    def class_name(self) -> str:
        return "User"


class UserService(InterfaceWithLifecycle):
    @abstractmethod
    def get_many_by_email(self, email: str) -> List[APIUser]:
        """
        Return a list of active users with verified emails matching the parameter
        :param email:
        A case insensitive email to match
        :return:
        """
        pass

    @abstractmethod
    def get_from_group(self, group: Group) -> List[APIUser]:
        """Get all users in all teams in a given Group's project."""
        pass

    @abstractmethod
    def get_from_project(self, project_id: int) -> List[Group]:
        """Get all users associated with a project identifier"""
        pass

    @abstractmethod
    def get_many(self, user_ids: Iterable[int]) -> List[APIUser]:
        """
        This method returns User objects given an iterable of IDs
        :param user_ids:
        A list of user IDs to fetch
        :return:
        """
        pass

    @abstractmethod
    def get_by_actor_id(self, actor_id: int) -> Optional[APIUser]:
        """
        This method returns a User object given an actor ID
        :param actor_id:
        An actor ID to fetch
        :return:
        """
        pass

    def get_user(self, user_id: int) -> Optional[APIUser]:
        """
        This method returns a User object given an ID
        :param user_id:
        A user ID to fetch
        :return:
        """
        users = self.get_many([user_id])
        if len(users) > 0:
            return users[0]
        else:
            return None

    # NOTE: In the future if this becomes RPC, we can avoid the double serialization problem by using a special type
    # with its own json serialization that allows pass through (ie, a string type that does not serialize into a string,
    # but rather validates itself as valid json and renders 'as is'.   Like "unescaped json text".
    @abstractmethod
    def serialize_users(self, user_ids: List[int]) -> List[Any]:
        """
        It is crucial that the returned order matches the user_ids passed in so that no introspection is required
        to match the serialized user and the original user_id.
        :param user_ids:
        :return:
        """
        pass

    @classmethod
    def serialize_user(cls, user: User) -> APIUser:
        args = {
            field.name: getattr(user, field.name)
            for field in fields(APIUser)
            if hasattr(user, field.name)
        }
        args["pk"] = user.pk
        args["display_name"] = user.get_display_name()
        args["is_superuser"] = user.is_superuser
        return APIUser(**args)


class DatabaseBackedUserService(UserService):
    def get_many_by_email(self, email: str) -> List[APIUser]:
        return [
            UserService.serialize_user(user)
            for user in User.objects.filter(
                emails__is_verified=True, is_active=True, emails__email__iexact=email
            )
        ]

    def serialize_users(self, user_ids: List[int]) -> List[Any]:
        result: List[Any] = []
        for user in User.objects.filter(id__in=user_ids):
            result.append(serialize(user))
        return result

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

    def get_by_actor_id(self, actor_id: int) -> Optional[APIUser]:
        try:
            return UserService.serialize_user(User.objects.get(actor_id=actor_id))
        except User.DoesNotExist:
            return None

    def close(self) -> None:
        pass


StubUserService = CreateStubFromBase(DatabaseBackedUserService)

user_service: UserService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedUserService(),
        SiloMode.REGION: lambda: StubUserService(),
        SiloMode.CONTROL: lambda: DatabaseBackedUserService(),
    }
)
