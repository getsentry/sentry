from enum import Enum

DEFAULT_MESSAGE = "Something went wrong during the sentry app process"


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
        message: str | None = None,
        status_code: int | None = None,
    ) -> None:
        if status_code:
            self.status_code = status_code
        self.message = message or DEFAULT_MESSAGE

    def __str__(self):
        return self.message


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(Exception):
    error_type = SentryAppErrorType.INTEGRATOR
    status_code = 400

    def __init__(
        self,
        message: str | None = None,
        status_code: int | None = None,
    ) -> None:
        if status_code:
            self.status_code = status_code
        self.message = message or DEFAULT_MESSAGE

    def __str__(self):
        return self.message
