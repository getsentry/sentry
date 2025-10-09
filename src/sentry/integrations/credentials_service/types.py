from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


class CredentialLeasable(ABC):
    """
    Interface for integrations that can lease credentials to other services.

    This is largely abstract, but is mainly used to flag which integration
    providers support this functionality.
    """

    @abstractmethod
    def get_maximum_lease_duration_seconds(self) -> int: ...

    @abstractmethod
    def refresh_access_token_with_minimum_validity_time(
        self, token_minimum_validity_time: timedelta
    ) -> CredentialLease: ...

    @abstractmethod
    def force_refresh_access_token(self) -> CredentialLease: ...

    @abstractmethod
    def get_active_access_token(self) -> CredentialLease: ...

    @abstractmethod
    def get_current_access_token_expiration(self) -> datetime | None: ...

    def does_access_token_expire_within(self, token_minimum_validity_time: timedelta) -> bool:
        expires_at = self.get_current_access_token_expiration()
        if not expires_at:
            return True

        # Ensure the expiration date we've been given is in UTC timezone.
        expires_at = expires_at.astimezone(UTC)

        minimum_expiry_time = datetime.now(UTC) + token_minimum_validity_time
        return expires_at < minimum_expiry_time


@dataclass
class CredentialLease:
    access_token: str
    permissions: dict[str, str] | None
    expires_at: datetime


class InvalidCredentialLeaseTarget(Exception):
    pass
