# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any, Dict, List, Optional, Tuple

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
from sentry.services.hybrid_cloud.user.model import RpcVerifyUserEmail, UserIdEmailArgs
from sentry.silo import SiloMode


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
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
        serializer: Optional[UserSerializeType] = None,
    ) -> List[OpaqueSerializedResponse]:
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserFilterArgs) -> List[RpcUser]:
        pass

    @rpc_method
    @abstractmethod
    def get_many_ids(self, *, filter: UserFilterArgs) -> List[int]:
        pass

    @rpc_method
    @abstractmethod
    def get_many_by_email(
        self,
        *,
        emails: List[str],
        is_active: bool = True,
        is_verified: bool = True,
        organization_id: Optional[int] = None,
    ) -> List[RpcUser]:
        """
        Return a list of users matching the filters
        :param email:
        A case insensitive email to match
        :return:
        """
        pass

    @rpc_method
    @abstractmethod
    def get_by_username(
        self, *, username: str, with_valid_password: bool = True, is_active: Optional[bool] = None
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

    @rpc_method
    @abstractmethod
    def get_existing_usernames(self, *, usernames: List[str]) -> List[str]:
        """Get all usernames from the set that belong to existing users."""

    @rpc_method
    @abstractmethod
    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> List[RpcOrganizationMapping]:
        """Get summary data for all organizations of which the user is a member.

        The organizations may span multiple regions.
        """
        pass

    @rpc_method
    @abstractmethod
    def update_user(self, *, user_id: int, attrs: UserUpdateArgs) -> Any:
        # Returns a serialized user
        pass

    @rpc_method
    @abstractmethod
    def flush_nonce(self, *, user_id: int) -> None:
        pass

    def get_user(self, user_id: int) -> Optional[RpcUser]:
        user = get_user(user_id)
        if user.is_anonymous:
            return None
        return user

    @rpc_method
    @abstractmethod
    def get_user_by_social_auth(
        self, *, organization_id: int, provider: str, uid: str
    ) -> Optional[RpcUser]:
        pass

    @rpc_method
    @abstractmethod
    def get_first_superuser(self) -> Optional[RpcUser]:
        pass

    @rpc_method
    @abstractmethod
    def get_or_create_user_by_email(
        self,
        *,
        email: str,
        ident: Optional[str] = None,
        referrer: Optional[str] = None,
    ) -> Tuple[RpcUser, bool]:
        pass

    @rpc_method
    @abstractmethod
    def get_user_by_email(
        self,
        *,
        email: str,
        ident: Optional[str] = None,
    ) -> Optional[RpcUser]:
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
        pass

    @rpc_method
    @abstractmethod
    def trigger_user_consent_email_if_applicable(self, *, user_id: int) -> None:
        pass

    @rpc_method
    @abstractmethod
    def verify_user_emails(
        self, *, user_id_emails: List[UserIdEmailArgs]
    ) -> Dict[int, RpcVerifyUserEmail]:
        pass


@back_with_silo_cache("user_service.get_user", SiloMode.REGION, RpcUser)
def get_user(user_id: int) -> RpcUser:
    users = user_service.get_many(filter=dict(user_ids=[user_id]))
    if len(users) > 0:
        return users[0]
    else:
        return RpcUser(is_anonymous=True)


user_service = UserService.create_delegation()
