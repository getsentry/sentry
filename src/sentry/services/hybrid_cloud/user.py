from abc import abstractmethod
from dataclasses import dataclass, fields
from typing import Any, Iterable, List, Optional, Sequence, Union

from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.models.group import Group
from sentry.models.organizationmember import OrganizationMember
from sentry.models.user import BaseUser, User
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass(frozen=True, eq=True)
class APIUser(BaseUser):
    id: int = -1
    pk: int = -1
    name: str = ""
    email: str = ""
    username: str = ""
    actor_id: int = -1
    display_name: str = ""

    def get_display_name(self):  # API compatibility with ORM User
        return self.display_name

    def class_name(self):
        return "User"


class UserService(InterfaceWithLifecycle):
    @abstractmethod
    def get_many_by_email(self, email: str, is_active=True) -> List[APIUser]:
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
    def get_many(self, user_ids: Iterable[int], is_active: Optional[bool] = True) -> List[APIUser]:
        """
        This method returns User objects given an iterable of IDs
        :param user_ids:
        A list of user IDs to fetch
        :return:
        """
        pass

    def get_by_actor_id(self, actor_id: int) -> Optional[APIUser]:
        """
        This method returns a User object given an actor ID
        :param actor_id:
        An actor ID to fetch
        :return:
        """
        pass

    def get_user(self, user_id: int, is_active=True) -> Optional[APIUser]:
        """
        This method returns a User object given an ID
        :param user_id:
        A user ID to fetch
        :return:
        """
        users = self.get_many([user_id], is_active=is_active)
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

    # TODO: Extract to base service?
    def _to_api(self, resp: Union[Sequence[User], Optional[User]]) -> Union[APIUser, List[APIUser]]:
        if resp is None:
            return None
        if type(resp) is APIUser:
            return resp
        if type(resp) is User:
            return self.serialize_user(resp)
        return list(map(lambda x: self._to_api(x), resp))

    @classmethod
    def serialize_user(cls, user: User) -> APIUser:
        args = {
            field.name: getattr(user, field.name)
            for field in fields(APIUser)
            if hasattr(user, field.name)
        }
        args["pk"] = user.pk
        args["display_name"] = user.get_display_name()
        return APIUser(**args)


class DatabaseBackedUserService(UserService):
    def get_many_by_email(self, email: str) -> Sequence[APIUser]:
        return self._to_api(
            User.objects.filter(
                emails__is_verified=True, is_active=True, emails__email__iexact=email
            )
        )

    def serialize_users(self, user_ids: List[int]) -> List[Any]:
        result: List[Any] = []
        for user in User.objects.filter(id__in=user_ids):
            result.append(serialize(user))
        return result

    def get_from_group(self, group: Group) -> List[APIUser]:
        group_memberships: Sequence[int] = OrganizationMember.objects.filter(
            organization=group.organization,
            teams__in=group.project.teams.all(),
        ).values_list("user_id", flat=True)
        return self.get_many(set(group_memberships))

    def get_many(self, user_ids: Iterable[int], is_active: Optional[bool] = True) -> List[APIUser]:
        query = User.objects.filter(id__in=user_ids)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        return self._to_api(query)

    def get_from_project(self, project_id: int) -> List[APIUser]:
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return []
        return self.get_many(project.member_set.values_list("user_id", flat=True))

    def get_by_actor_id(self, actor_id: int) -> Optional[APIUser]:
        return self._to_api(User.objects.get(actor_id=actor_id))

    def close(self):
        pass


StubUserService = CreateStubFromBase(DatabaseBackedUserService)

user_service: UserService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedUserService,
        SiloMode.REGION: StubUserService,
        SiloMode.CONTROL: DatabaseBackedUserService,
    }
)
