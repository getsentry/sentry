# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any, List, Optional, cast

from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.services.hybrid_cloud.user import (
    RpcUser,
    UserFilterArgs,
    UserSerializeType,
    UserUpdateArgs,
)
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
    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> List[RpcOrganizationSummary]:
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

    @rpc_method
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

    @rpc_method
    @abstractmethod
    def get_user_by_social_auth(
        self, *, organization_id: int, provider: str, uid: str
    ) -> Optional[RpcUser]:
        pass


user_service: UserService = cast(UserService, UserService.create_delegation())
