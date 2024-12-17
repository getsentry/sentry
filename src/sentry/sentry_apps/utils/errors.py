import functools
from enum import Enum
from typing import Any

import sentry_sdk
from rest_framework.exceptions import APIException
from rest_framework.response import Response


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
        error: Exception | APIException | None = None,
        status_code: int | None = None,
    ) -> None:
        if isinstance(error, APIException):
            # APIException's default serialization will return a dict, we just want the message
            self.args = error.args or error.default_detail

        if status_code:
            self.status_code = status_code


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(Exception):
    error_type = SentryAppErrorType.INTEGRATOR
    status_code = 400

    def __init__(
        self,
        error: Exception | APIException | None = None,
        status_code: int | None = None,
    ) -> None:
        if isinstance(error, APIException):
            # APIException's default serialization will return a dict, we just want the message
            self.args = error.args or error.default_detail

        if status_code:
            self.status_code = status_code


def catch_and_handle_sentry_app_errors(func: Any):

    @functools.wraps(func)
    def decorator(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except (SentryAppError, SentryAppIntegratorError) as e:
            return Response({"error": str(e)}, status=e.status_code)
        except Exception as e:
            error_id = sentry_sdk.capture_exception(e)
            return Response(
                {"error": f"Something went wrong! Sentry Error ID: {error_id}"}, status=500
            )

    return decorator


# Errors in base API classes will first go through DRFs default exception handler
# so we need to intercept and reraise here to apply our custom handler
@catch_and_handle_sentry_app_errors
def sentry_app_error_exception_handler(exc, context):
    raise exc
