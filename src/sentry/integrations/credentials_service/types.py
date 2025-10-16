from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sentry.silo.base import control_silo_function


class CredentialLeasable(ABC):
    """
    Interface for integrations that can lease credentials to other services.

    This is largely abstract, but is mainly used to flag which integration
    providers support this functionality.

    NOTE: Every this implementation is currently coupled to our integration
    installations. This implementation does _not_ guarantee concurrency safety,
    so make sure that the provider implementation is thread/process safe.
    """

    @abstractmethod
    def get_maximum_lease_duration_seconds(self) -> int: ...

    """
    Returns the maximum length a token can be leased for. Typically, this should
    be the maximum token validity on the provider this is implemented for.
    """

    @control_silo_function
    def refresh_access_token_with_minimum_validity_time(
        self, token_minimum_validity_time: timedelta
    ) -> CredentialLease:
        """
        Conditionally refreshes the installation's access token if the current token
        would expire within the given minimum validity time. Returns a new
        credential lease.
        """
        return self._refresh_access_token_with_minimum_validity_time(token_minimum_validity_time)

    @abstractmethod
    def _refresh_access_token_with_minimum_validity_time(
        self, token_minimum_validity_time: timedelta
    ) -> CredentialLease: ...

    @control_silo_function
    def force_refresh_access_token(self) -> CredentialLease:
        """
        Force rotates an access token, regardless of the remaining validity.
        This can be useful for ensuring the maximum token validity, or if a token is
        compromised for any reason.
        """

        return self._force_refresh_access_token()

    @abstractmethod
    def _force_refresh_access_token(self) -> CredentialLease: ...

    @control_silo_function
    def get_active_access_token(self) -> CredentialLease:
        """
        Returns the current active access token. This may refresh the token if it
        has already expired, though this is up to the provider implementation. This
        """
        return self._get_active_access_token()

    @abstractmethod
    def _get_active_access_token(self) -> CredentialLease: ...

    @abstractmethod
    def get_current_access_token_expiration(self) -> datetime | None: ...

    """
    Returns the current expiration time of the active access token, if there is
    one.
    """

    def does_access_token_expire_within(self, token_minimum_validity_time: timedelta) -> bool:
        """
        Checks if the active access token will expire within the given minimum
        validity time. This will largely be used by the credentials service to
        determine which access token method to call.
        """
        expires_at = self.get_current_access_token_expiration()
        if not expires_at:
            return True

        # Ensure the expiration date we've been given is in UTC timezone.
        expires_at = expires_at.astimezone(UTC)

        minimum_expiry_time = datetime.now(UTC) + token_minimum_validity_time
        return expires_at < minimum_expiry_time


@dataclass
class CredentialLease:
    """
    Represents a leased access token, though makes no guarantee about the
    validity of the token. It's entirely possible that the token has expired,
    or was invalidated by the provider.
    """

    access_token: str
    permissions: dict[str, str] | None
    expires_at: datetime | None


class InvalidCredentialLeaseTarget(Exception):
    pass
