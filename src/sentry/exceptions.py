from typing import Any

from django.core.exceptions import SuspiciousOperation
from rest_framework.exceptions import ParseError


class InvalidData(Exception):
    pass


class InvalidInterface(InvalidData):
    pass


class InvalidRequest(Exception):
    pass


class InvalidOrigin(InvalidRequest):
    def __init__(self, origin: str) -> None:
        self.origin = origin

    def __str__(self) -> str:
        return "Invalid origin: '%s'" % self.origin


class InvalidConfiguration(Exception):
    pass


class DeleteAborted(Exception):
    pass


class RestrictedIPAddress(SuspiciousOperation):
    pass


class PluginError(Exception):
    pass


class PluginIdentityRequired(PluginError):
    pass


class InvalidIdentity(Exception):
    def __init__(self, message: str = "", identity: object | None = None) -> None:
        super().__init__(message)
        self.identity = identity


class HookValidationError(Exception):
    pass


class NotRegistered(Exception):
    pass


class ApiTokenLimitError(Exception):
    pass


class InvalidSearchQuery(Exception):
    extra: dict[str, Any] | None = None
    pass


class InvalidFunctionArgumentQuery(InvalidSearchQuery):
    """A query function rejected one of its arguments.

    Carries the function and the argument as written so API clients can tell which
    expression to fix without parsing the message, plus an optional `hint` that
    suggests a fix when one is known.
    """

    def __init__(
        self, message: str, *, function: str, argument: str, hint: str | None = None
    ) -> None:
        super().__init__(message)
        self.function = function
        self.argument = argument
        self.hint = hint


class SearchQueryParseError(InvalidSearchQuery):
    """The search query string failed to parse or validate.

    Lets API clients tell a rejected `query` parameter apart from other invalid
    query errors without parsing the message.
    """


class IncompatibleMetricsQuery(Exception):
    # Tried to build a metrics enhanced performance query but it was incompatible
    pass


class UnableToAcceptMemberInvitationException(Exception):
    pass


class UnsupportedQuerySubscription(Exception):
    pass


class InvalidQuerySubscription(Exception):
    pass


class HashDiscarded(Exception):
    def __init__(
        self, message: str = "", reason: str | None = None, tombstone_id: int | None = None
    ):
        super().__init__(message)
        self.reason = reason
        self.tombstone_id = tombstone_id


class InvalidParams(ParseError):
    """Inherits from ParseError so DRF automatically returns a 400 response
    when this exception is unhandled in a view."""

    pass


class MissingTTL(Exception):
    def __init__(self, key: str) -> None:
        super().__init__(
            f"Refusing to write {key!r} with no expiry. Every new Redis key sets a TTL, or is "
            "registered with Infrastructure Engineering as accepted durable data. There is no "
            "opt-out at the callsite: "
            "https://develop.sentry.dev/backend/application-domains/redis/"
        )
