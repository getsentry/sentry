from enum import Enum
from typing import Any, TypedDict


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


class ErrorContext(TypedDict, total=False):
    # Info that gets sent only to the integrator via webhook
    webhook_context: dict[str, Any]
    # Info that gets sent to the end user via endpoint Response AND sent to integrator
    public_context: dict[str, Any]


class SentryAppBaseError(Exception):
    error_type: SentryAppErrorType
    status_code: int

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        extras: ErrorContext | None = None,
    ) -> None:
        self.status_code = status_code or self.status_code
        self.extras = extras or {}
        self.message = message


# Represents a user/client error that occured during a Sentry App process
class SentryAppError(SentryAppBaseError):
    error_type = SentryAppErrorType.CLIENT
    status_code = 400


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(SentryAppBaseError):
    error_type = SentryAppErrorType.INTEGRATOR
    status_code = 400


# Represents an error that's our (sentry's) fault
class SentryAppSentryError(SentryAppBaseError):
    error_type = SentryAppErrorType.SENTRY
    status_code = 500
