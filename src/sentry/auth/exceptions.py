__all__ = ["ProviderNotRegistered"]

from sentry.exceptions import NotRegistered


class ProviderNotRegistered(NotRegistered):
    pass


class IdentityNotValid(Exception):
    pass


class AuthIdentityUserMismatch(Exception):
    pass


class PipelineStateExpired(Exception):
    pass


class ProviderMismatch(Exception):
    def __init__(self, actual: str, expected: str) -> None:
        self.actual = actual
        self.expected = expected
        super().__init__(f"Expected provider {expected}, got {actual}")
