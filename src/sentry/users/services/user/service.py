# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from typing import Any

from sentry.auth.services.auth import AuthenticationContext
from sentry.hybridcloud.rpc.caching import back_with_silo_cache, back_with_silo_cache_many
from sentry.hybridcloud.rpc.filter_query import OpaqueSerializedResponse
from sentry.hybridcloud.rpc.service import RpcService, rpc_method
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.silo.base import SiloMode
from sentry.users.services.user import RpcUser, UserFilterArgs, UserSerializeType, UserUpdateArgs
from sentry.users.services.user.model import (
    RpcAvatar,
    RpcUserProfile,
    RpcVerifyUserEmail,
    UserCreateResult,
    UserIdEmailArgs,
)


class UserService(RpcService):
    key = "user"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.users.services.user.impl import DatabaseBackedUserService

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
        """
        Get a list of users serialized as dictionaries with the API serializer.

        This is most useful when you need to stitch users into an API response.

        :param filter: Filtering options. See UserFilterArgs
        :param as_user: The user making the request, this is used to perform field level authorization required by the serializer
        :param auth_context: Authentication context that the request is being made under.
        :param serializer: The serializer to use.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_many(self, *, filter: UserFilterArgs) -> list[RpcUser]:
        """
        Get a list of users as RpcUser objects.

        :param filter: Filtering options. See UserFilterArgs
        """
        pass

    @rpc_method
    @abstractmethod
    def get_many_ids(self, *, filter: UserFilterArgs) -> list[int]:
        """
        Get a list of userids that match the filter operation

        This is a more efficient way to fetch users when you need to create
        query conditions on other tables.

        :param filter: Filtering options. See UserFilterArgs
        """
        pass

    @rpc_method
    @abstractmethod
    def get_many_profiles(self, *, filter: UserFilterArgs) -> list[RpcUserProfile]:
        """
        Get a list of RpcUserProfile matching `filter`

        If you only need basic profile information about a user this is more efficient
        than `get_many`

        :param filter: Filtering options. See UserFilterArgs
        """
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

        :param emails: A list of case insensitive emails to match
        :param is_active: Whether the users need to be active
        :param is_verified: Whether the user's emails need to be verified.
        """

    def get_many_by_id(self, *, ids: list[int]) -> list[RpcUser]:
        """
        Get many users by id.

        Will use region local cache to minimize network overhead.
        Cache keys in regions will be expired as users are updated via outbox receivers.

        :param ids: A list of user ids to fetch
        """
        return get_many_by_id(ids)

    @rpc_method
    @abstractmethod
    def get_by_username(
        self, *, username: str, with_valid_password: bool = True, is_active: bool | None = None
    ) -> list[RpcUser]:
        """
        Return a list of users that match a username and falling back to email.

        :param username: A case insensitive username/email to match
        :param with_valid_password: filter to ensure a password is set
        :param is_active: filter for only active users
        """

    @rpc_method
    @abstractmethod
    def get_existing_usernames(self, *, usernames: list[str]) -> list[str]:
        """
        Get all usernames from the set that belong to existing users.

        :param usernames: A list of usernames to match
        """

    @rpc_method
    @abstractmethod
    def get_organizations(
        self,
        *,
        user_id: int,
        only_visible: bool = False,
    ) -> list[RpcOrganizationMapping]:
        """
        Get summary data for all organizations of which the user is a member.

        The organizations may span multiple regions.

        :param user_id: The user to find organizations from.
        :param only_visible: Whether or not to only fetch visible organizations
        """

    @rpc_method
    @abstractmethod
    def get_member_region_names(self, *, user_id: int) -> list[str]:
        """
        Get a list of region names where the user is a member of at least one org.

        :param user_id: The user to fetch region names for.
        """

    @rpc_method
    @abstractmethod
    def update_user(self, *, user_id: int, attrs: UserUpdateArgs) -> Any:
        """
        Update a user and return the API serialized form

        :param user_id: The user to update
        :param attrs: A dictionary of properties to update.
        """
        pass

    @rpc_method
    @abstractmethod
    def flush_nonce(self, *, user_id: int) -> None:
        """
        Reset a user's session nonce

        This will log out all sessions that don't contain the same session nonce.

        :param user_id: The user to update
        """
        pass

    def get_user(self, user_id: int) -> RpcUser | None:
        """
        Get a single user by id

        The result of this method is cached.

        :param user_id: The user to fetch
        """
        return get_user(user_id)

    @rpc_method
    @abstractmethod
    def get_user_by_social_auth(
        self, *, organization_id: int, provider: str, uid: str
    ) -> RpcUser | None:
        """
        Get a user for a given organization, social auth provider and public id

        :param organization_id: The organization to search in.
        :param provider: the authentication provider to search in.
        :param uid: The external id to search with.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_first_superuser(self) -> RpcUser | None:
        """
        Get the first superuser in the database.

        The results of this method are ordered by id
        """
        pass

    @rpc_method
    @abstractmethod
    def get_or_create_by_email(
        self,
        *,
        email: str,
        ident: str | None = None,
        referrer: str | None = None,
    ) -> UserCreateResult:
        """
        Get or create a user with a matching email address or AuthIdentity

        :param email: The email to search by.
        :param ident: If provided, and multiple users are found with a matching email, the ident
          is used to narrow down results.
        """
        pass

    @rpc_method
    @abstractmethod
    def get_user_by_email(
        self,
        *,
        email: str,
        ident: str | None = None,
    ) -> RpcUser | None:
        """
        Get a user with a matching email address or AuthIdentity

        :param email: The email/username to use.
        :param ident: If provided, and multiple users are found with a matching email, the ident
          is used to narrow down results.
        """
        pass

    @rpc_method
    @abstractmethod
    def verify_user_email(self, *, email: str, user_id: int) -> bool:
        """
        Verify a user's email address

        :param email: The email to verify
        :param user_id: The user id to verify email for.
        """
        pass

    @rpc_method
    @abstractmethod
    def verify_any_email(self, *, email: str) -> bool:
        """
        Verifies the first email address (ordered by id) that matches.

        :param email: The email to verify.
        """
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
        """
        Get a user's avatar if available

        :param user_id: The user to get an avatar for.
        """
        pass


@back_with_silo_cache("user_service.get_user", SiloMode.REGION, RpcUser)
def get_user(user_id: int) -> RpcUser | None:
    users = user_service.get_many(filter={"user_ids": [user_id]})
    if len(users) > 0:
        return users[0]
    return None


@back_with_silo_cache_many("user_service.get_many_by_id", SiloMode.REGION, RpcUser)
def get_many_by_id(ids: list[int]) -> list[RpcUser]:
    return user_service.get_many(filter={"user_ids": ids})


user_service = UserService.create_delegation()
