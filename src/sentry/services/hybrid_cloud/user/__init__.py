# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from abc import abstractmethod
from dataclasses import dataclass
from enum import IntEnum
from typing import TYPE_CHECKING, Any, FrozenSet, List, Optional, TypedDict

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Group
    from sentry.services.hybrid_cloud.auth import AuthenticationContext


@dataclass(frozen=True, eq=True)
class RpcAvatar:
    id: int = 0
    file_id: int = 0
    ident: str = ""
    avatar_type: str = "letter_avatar"


@dataclass(frozen=True, eq=True)
class RpcUserEmail:
    id: int = 0
    email: str = ""
    is_verified: bool = False


@dataclass(frozen=True, eq=True)
class RpcAuthenticator:
    id: int = 0
    user_id: int = -1
    created_at: datetime.datetime = datetime.datetime(2000, 1, 1)
    last_used_at: datetime.datetime = datetime.datetime(2000, 1, 1)
    type: int = -1
    config: Any = None


@dataclass(frozen=True, eq=True)
class RpcUser:
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
    last_active: Optional[datetime.datetime] = None
    is_sentry_app: bool = False
    password_usable: bool = False
    is_password_expired: bool = False
    session_nonce: str = ""

    roles: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()
    avatar: Optional[RpcAvatar] = None
    useremails: FrozenSet[RpcUserEmail] = frozenset()
    authenticators: FrozenSet[RpcAuthenticator] = frozenset()

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

    def has_2fa(self) -> bool:
        return len(self.authenticators) > 0


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


class UserUpdateArgs(TypedDict, total=False):
    avatar_url: str
    avatar_type: int
    actor_id: int  # TODO(hybrid-cloud): Remove this after the actor migration is complete


class UserService(InterfaceWithLifecycle):
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: UserFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional["AuthenticationContext"] = None,
        serializer: Optional[UserSerializeType] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @abstractmethod
    def get_many(self, *, filter: UserFilterArgs) -> List[RpcUser]:
        pass

    @abstractmethod
    def get_many_by_email(
        self,
        emails: List[str],
        is_active: bool = True,
        is_verified: bool = True,
        is_project_member: bool = False,
        project_id: Optional[int] = None,
    ) -> List[RpcUser]:
        """
        Return a list of users matching the filters
        :param email:
        A case insensitive email to match
        :return:
        """
        pass

    @abstractmethod
    def get_by_username(
        self, username: str, with_valid_password: bool = True, is_active: Optional[bool] = None
    ) -> List[RpcUser]:
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
    def get_from_group(self, group: "Group") -> List[RpcUser]:
        """Get all users in all teams in a given Group's project."""
        pass

    @abstractmethod
    def get_by_actor_ids(self, *, actor_ids: List[int]) -> List[RpcUser]:
        pass

    @abstractmethod
    def update_user(
        self,
        *,
        user_id: int,
        attrs: UserUpdateArgs,
    ) -> Any:
        # Returns a serialized user
        pass

    def get_user(self, user_id: int) -> Optional[RpcUser]:
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
