from enum import Enum
from typing import Any, TypedDict, int

import sentry_sdk
from rest_framework.response import Response


class SentryAppErrorType(Enum):
    CLIENT = "client"
    INTEGRATOR = "integrator"
    SENTRY = "sentry"


class SentryAppPublicErrorBody(TypedDict, total=False):
    detail: str
    context: dict[str, Any]


class SentryAppBaseError(Exception):
    error_type: SentryAppErrorType
    status_code: int

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        public_context: dict[str, Any] | None = None,
        webhook_context: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code or self.status_code
        # Info that gets sent only to the integrator via webhook
        self.public_context = public_context or {}
        # Info that gets sent to the end user via endpoint Response AND sent to integrator
        self.webhook_context = webhook_context or {}
        self.message = message

    def to_public_dict(self) -> SentryAppPublicErrorBody:
        error_body: SentryAppPublicErrorBody = {"detail": self.message}
        if public_context := self.public_context:
            error_body.update({"context": public_context})

        return error_body

    def response_from_exception(self) -> Response:
        response: dict[str, Any] = {"detail": self.message}
        if public_context := self.public_context:
            response.update({"context": public_context})
        return Response(response, status=self.status_code)

    def __repr__(self) -> str:
        return f"{type(self).__name__}: message={self.message} status_code={self.status_code} error_type={self.error_type}"


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

    def to_public_dict(self) -> SentryAppPublicErrorBody:
        error_id = sentry_sdk.capture_exception(self, level="info")
        return {
            "detail": f"An issue occured during the integration platform process. Sentry error ID: {error_id}"
        }

    def response_from_exception(self) -> Response:
        sentry_sdk.capture_exception(self)
        response: dict[str, Any] = {
            "detail": "Something went wrong during the custom integration process!"
        }
        if public_context := self.public_context:
            response.update({"context": public_context})
        return Response(response, status=self.status_code)
