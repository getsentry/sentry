from enum import Enum
from typing import Any


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


# Represents a user/client error that occured during a Sentry App process
class SentryAppError(Exception):
    error_type = SentryAppErrorType.CLIENT
    status_code = 400

    def __init__(
        self,
        error: Exception | None = None,
        status_code: int | None = None,
        **details: Any,
    ) -> None:
        if status_code:
            self.status_code = status_code
        self.details = details
        self.error = error


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(Exception):
    error_type = SentryAppErrorType.INTEGRATOR
    status_code = 400

    def __init__(
        self,
        error: Exception | None = None,
        status_code: int | None = None,
        **details: Any,
    ) -> None:
        if status_code:
            self.status_code = status_code
        self.error = error
        self.details = details


# Represents an error that's our (sentry's) fault
class SentryAppSentryError(Exception):
    error_type = SentryAppErrorType.SENTRY
    status_code = 500

    def __init__(
        self,
        error: Exception | None = None,
        status_code: int | None = None,
    ) -> None:
        if status_code:
            self.status_code = status_code
        self.error = error
