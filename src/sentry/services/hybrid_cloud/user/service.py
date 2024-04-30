# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.hybridcloud.rpc.services.caching import back_with_silo_cache
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.organization_mapping.model import RpcOrganizationMapping
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import (
    RpcUser,
    UserFilterArgs,
    UserSerializeType,
    UserUpdateArgs,
)
from sentry.services.hybrid_cloud.user.model import (
    RpcAvatar,
    RpcUserProfile,
    RpcVerifyUserEmail,
    UserIdEmailArgs,
)
from sentry.silo.base import SiloMode
from sentry.utils import metrics


class UserService(RpcService):
    key = "user"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.user.impl import DatabaseBackedUserService

        return DatabaseBackedUserService()

    @rpc_method
    @abstractmethod
    def serialize_many(
        self,
        *,
        filter: UserFilterArgs,
        as_user: RpcUser | None = None,
        auth_context: AuthenticationContext | None = None,
        serializer: UserSerializeType | None = None,
    ) -> list[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserFilterArgs) -> list[RpcUser]:
        pass

    @rpc_method
    @abstractmethod
    def get_many_ids(self, *, filter: UserFilterArgs) -> list[int]:
        pass

    @rpc_method
    @abstractmethod
    def get_many_profiles(self, *, filter: UserFilterArgs) -> list[RpcUserProfile]:
        pass

    @rpc_method
    @abstractmethod
    def get_many_by_email(
        self,
        *,
        emails: list[str],
        is_active: bool = True,
        is_verified: bool = True,
        organization_id: int | None = None,
    ) -> list[RpcUser]:
        """
        Return a list of users matching the filters
        :param email:
        A case insensitive email to match
        :return:
        """

    @rpc_method
    @abstractmethod
    def get_by_username(
        self, *, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> list[RpcUser]:
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

    @rpc_method
    @abstractmethod
    def get_existing_usernames(self, *, usernames: list[str]) -> list[str]:
        """Get all usernames from the set that belong to existing users."""

    @rpc_method
    @abstractmethod
    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> list[RpcOrganizationMapping]:
        """Get summary data for all organizations of which the user is a member.

        The organizations may span multiple regions.
        """

    @rpc_method
    @abstractmethod
    def get_member_region_names(self, *, user_id: int) -> list[str]:
        """Get a list of region names where the user is a member of at least one org."""

    @rpc_method
    @abstractmethod
    def update_user(self, *, user_id: int, attrs: UserUpdateArgs) -> Any:
        # Returns a serialized user
        pass

    @rpc_method
    @abstractmethod
    def flush_nonce(self, *, user_id: int) -> None:
        pass

    def get_user(self, user_id: int) -> RpcUser | None:
        metrics.incr("user_service.get_user.call")
        return get_user(user_id)

    @rpc_method
    @abstractmethod
    def get_user_by_social_auth(
        self, *, organization_id: int, provider: str, uid: str
    ) -> RpcUser | None:
        pass

    @rpc_method
    @abstractmethod
    def get_first_superuser(self) -> RpcUser | None:
        pass

    @rpc_method
    @abstractmethod
    def get_or_create_user_by_email(
        self,
        *,
        email: str,
        ident: str | None = None,
        referrer: str | None = None,
    ) -> tuple[RpcUser, bool]:
        pass

    @rpc_method
    @abstractmethod
    def get_user_by_email(
        self,
        *,
        email: str,
        ident: str | None = None,
    ) -> RpcUser | None:
        pass

    @rpc_method
    @abstractmethod
    def verify_user_email(self, *, email: str, user_id: int) -> bool:
        pass

    @rpc_method
    @abstractmethod
    def verify_any_email(self, *, email: str) -> bool:
        pass

    @rpc_method
    @abstractmethod
    def create_by_username_and_email(self, *, email: str, username: str) -> RpcUser:
        """
        Creates a new user via a combination of email and username.
        This is not idempotent and only really intended for legacy
        Heroku provisioning.
        :param email: The user's email address
        :param username: The user's username
        :return: RpcUser of the newly created user
        """

    @rpc_method
    @abstractmethod
    def trigger_user_consent_email_if_applicable(self, *, user_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def verify_user_emails(
        self, *, user_id_emails: list[UserIdEmailArgs], only_verified: bool = False
    ) -> dict[int, RpcVerifyUserEmail]:
        pass

    @rpc_method
    @abstractmethod
    def get_user_avatar(self, *, user_id: int) -> RpcAvatar | None:
        pass


@back_with_silo_cache("user_service.get_user", SiloMode.REGION, RpcUser)
def get_user(user_id: int) -> RpcUser | None:
    metrics.incr("user_service.get_user.rpc_call")
    users = user_service.get_many(filter=dict(user_ids=[user_id]))
    if len(users) > 0:
        return users[0]
    return None


user_service = UserService.create_delegation()
