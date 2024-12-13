import functools
from collections.abc import Callable
from enum import Enum
from typing import Any

import sentry_sdk
from rest_framework.response import Response


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


# Represents a user/client error that occured during a Sentry App process
class SentryAppError(Exception):
    error_type = SentryAppErrorType.CLIENT


# Represents an error caused by a 3p integrator during a Sentry App process
class SentryAppIntegratorError(Exception):
    error_type = SentryAppErrorType.INTEGRATOR


def catch_and_handle_sentry_app_errors(func: Callable[[Any, Any], Any]):

    @functools.wraps(func)
    def decorator(*args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except (SentryAppError, SentryAppIntegratorError) as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            error_id = sentry_sdk.capture_exception(e)
            return Response(
                {"error": f"Something went wrong! Sentry Error ID: {error_id}"}, status=500
            )

    return decorator
