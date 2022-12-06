from __future__ import annotations

import datetime
from abc import abstractmethod
from dataclasses import dataclass, fields
from enum import IntEnum
from typing import TYPE_CHECKING, Any, Iterable, List, Optional

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Group, User
    from sentry.services.hybrid_cloud.auth import AuthenticationContext


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
    is_staff: bool = False
    last_active: datetime.datetime | None = None
    is_sentry_app: bool = False
    password_usable: bool = False

    def has_usable_password(self) -> bool:
        return self.password_usable

    def get_display_name(self) -> str:  # API compatibility with ORM User
        return self.display_name

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.username

    def class_name(self) -> str:
        return "User"


class UserSerializeType(IntEnum):
    SIMPLE = 0
    DETAILED = 1
    SELF_DETAILED = 2


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
    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[APIUser]:
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
    def serialize_users(
        self,
        user_ids: List[int],
        *,
        detailed: UserSerializeType = UserSerializeType.SIMPLE,
        auth_context: AuthenticationContext | None = None,
    ) -> List[Any]:
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
        args["password_usable"] = user.has_usable_password()
        return APIUser(**args)


def impl_with_db() -> UserService:
    from sentry.services.hybrid_cloud.user.impl import DatabaseBackedUserService

    return DatabaseBackedUserService()


user_service: UserService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
