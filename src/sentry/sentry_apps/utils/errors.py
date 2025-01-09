from enum import Enum

from sentry.utils import json


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


class SentryAppBaseError(Exception):
    error_type: SentryAppErrorType
    status_code: int

    def __init__(
        self,
        error: Exception | None = None,
        status_code: int | None = None,
    ) -> None:
        self.status_code = status_code or self.status_code
        self.error = error

    def __str__(self) -> str:
        if self.error is not None:
            return json.dumps(self.error.args)
        return ""


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
