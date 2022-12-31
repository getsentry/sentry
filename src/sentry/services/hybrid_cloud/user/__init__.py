from __future__ import annotations

import datetime
from abc import abstractmethod
from dataclasses import dataclass, fields
from enum import IntEnum
from typing import TYPE_CHECKING, Any, FrozenSet, Iterable, List, Optional

from sentry.db.models import BaseQuerySet
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


class UserSerializeType(IntEnum):
    SIMPLE = 0
    DETAILED = 1
    SELF_DETAILED = 2


class UserService(InterfaceWithLifecycle):
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

    @abstractmethod
    def query_users(
        self,
        user_ids: Optional[List[int]] = None,
        is_active: Optional[bool] = None,
        organization_id: Optional[int] = None,
        project_ids: Optional[List[int]] = None,
        team_ids: Optional[List[int]] = None,
        is_active_memberteam: Optional[bool] = None,
        emails: Optional[List[str]] = None,
    ) -> List[User]:
        pass

    # NOTE: In the future if this becomes RPC, we can avoid the double serialization problem by using a special type
    # with its own json serialization that allows pass through (ie, a string type that does not serialize into a string,
    # but rather validates itself as valid json and renders 'as is'.   Like "unescaped json text".
    @abstractmethod
    def serialize_users(
        self,
        *,
        detailed: UserSerializeType = UserSerializeType.SIMPLE,
        auth_context: AuthenticationContext
        | None = None,  # TODO: replace this with the as_user attribute
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
