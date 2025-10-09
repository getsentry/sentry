from abc import ABC, abstractmethod
from datetime import timedelta


class CredentialLeasableMixin(ABC):
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
    ) -> str: ...

    @abstractmethod
    def force_refresh_access_token(self) -> str: ...

    @abstractmethod
    def get_active_access_token(self) -> str: ...

    @abstractmethod
    def does_access_token_expire_within(self, token_minimum_validity_time: timedelta) -> bool: ...


class InvalidCredentialLeaseTarget(Exception):
    pass
