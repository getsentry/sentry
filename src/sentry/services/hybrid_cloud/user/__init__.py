from __future__ import annotations

import datetime
from abc import abstractmethod
from dataclasses import dataclass
from enum import IntEnum
from typing import TYPE_CHECKING, FrozenSet, List, Optional, TypedDict

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.filter_query import FilterQueryInterface
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Group


@dataclass(frozen=True, eq=True)
class APIUser:
    id: int = -1
    pk: int = -1
    name: str = ""
    email: str = ""
    emails: FrozenSet[str] = frozenset()
    username: str = ""
    actor_id: int = -1
    display_name: str = ""
    label: str = ""
    is_superuser: bool = False
    is_authenticated: bool = False
    is_anonymous: bool = False
    is_active: bool = False
    is_staff: bool = False
    last_active: datetime.datetime | None = None
    is_sentry_app: bool = False
    password_usable: bool = False
    is_password_expired: bool = False
    session_nonce: str = ""

    roles: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()
    avatar: Optional[APIAvatar] = None
    useremails: FrozenSet[APIUserEmail] = frozenset()

    def has_usable_password(self) -> bool:
        return self.password_usable

    def get_display_name(self) -> str:  # API compatibility with ORM User
        return self.display_name

    def get_label(self) -> str:  # API compatibility with ORM User
        return self.label

    def get_full_name(self) -> str:
        return self.name

    def get_short_name(self) -> str:
        return self.username

    def get_avatar_type(self) -> str:
        if self.avatar is not None:
            return self.avatar.avatar_type
        return "letter_avatar"

    def class_name(self) -> str:
        return "User"


@dataclass(frozen=True, eq=True)
class APIAvatar:
    id: int = 0
    file_id: int = 0
    ident: str = ""
    avatar_type: str = "letter_avatar"


@dataclass(frozen=True, eq=True)
class APIUserEmail:
    id: int = 0
    email: str = ""
    is_verified: bool = False


class UserSerializeType(IntEnum):  # annoying
    SIMPLE = 0
    DETAILED = 1
    SELF_DETAILED = 2


class UserFilterArgs(TypedDict, total=False):
    user_ids: List[int]
    is_active: bool
    organization_id: int
    project_ids: List[int]
    team_ids: List[int]
    is_active_memberteam: bool
    emails: List[str]


class UserService(
    FilterQueryInterface[UserFilterArgs, APIUser, UserSerializeType], InterfaceWithLifecycle
):
    @abstractmethod
    def get_many_by_email(
        self, emails: List[str], is_active: bool = True, is_verified: bool = True
    ) -> List[APIUser]:
        """
        Return a list of users matching the filters
        :param email:
        A case insensitive email to match
        :return:
        """
        pass

    @abstractmethod
    def get_by_username(
        self, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> List[APIUser]:
        """
        Return a list of users that match a username and falling back to email
        :param username:
        A case insensitive username/email to match
        :param with_valid_password:
        filter to ensure a password is set
        :param is_active:
        filter for only active users
        :return:
        """
        pass

    @abstractmethod
    def get_from_group(self, group: Group) -> List[APIUser]:
        """Get all users in all teams in a given Group's project."""
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
        users = self.get_many(filter=dict(user_ids=[user_id]))
        if len(users) > 0:
            return users[0]
        else:
            return None


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
