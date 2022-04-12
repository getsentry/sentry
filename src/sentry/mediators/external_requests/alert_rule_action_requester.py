import logging
from typing import TypedDict
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

from requests import RequestException
from rest_framework.response import Response

from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests.util import send_and_save_sentry_app_request
from sentry.utils import json
from sentry.utils.cache import memoize

logger = logging.getLogger("sentry.mediators.external-requests")

DEFAULT_SUCCESS_MESSAGE = "Success!"
DEFAULT_ERROR_MESSAGE = "Something went wrong!"


class AlertRuleActionRequesterResult(TypedDict):
    success: bool
    message: str


class AlertRuleActionRequester(Mediator):
    """
    Makes a POST request to another service to fetch/update the values for each field in the
    AlertRuleAction settings schema
    """

    install = Param("sentry.models.SentryAppInstallation")
    uri = Param((str,))
    fields = Param(list, required=False, default=[])
    http_method = Param(str, required=False, default="POST")

    def call(self):
        return self._make_request()

    def _build_url(self):
        urlparts = list(urlparse(self.sentry_app.webhook_url))
        urlparts[2] = self.uri
        return urlunparse(urlparts)

    def _get_error_message(self, response: Response) -> str:
        """
        Returns the error message from the response body, if in the expected location.
        The location should be coordinated with the docs on Alert Rule Action UI Components.
        """
        try:
            error_message = response.json().get("message", DEFAULT_ERROR_MESSAGE)
        except Exception:
            error_message = DEFAULT_ERROR_MESSAGE
        return error_message

    def _make_request(self) -> AlertRuleActionRequesterResult:
        try:
            send_and_save_sentry_app_request(
                self._build_url(),
                self.sentry_app,
                self.install.organization_id,
                "alert_rule_action.requested",
                headers=self._build_headers(),
                method=self.http_method,
                data=self.body,
            )
        except RequestException as e:
            logger.info(
                "alert_rule_action.error",
                extra={
                    "sentry_app_slug": self.sentry_app.slug,
                    "install_uuid": self.install.uuid,
                    "uri": self.uri,
                    "error_message": str(e),
                },
            )
            message = f"{self.sentry_app.name} Error: {self._get_error_message(e.response)}"
            # Bubble up error message from Sentry App to the UI for the user.
            return AlertRuleActionRequesterResult(success=False, message=message)
        # No messages are bubbled up from successful responses.
        return AlertRuleActionRequesterResult(success=True, message=DEFAULT_SUCCESS_MESSAGE)

    def _build_headers(self):
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(self.body),
        }

    @memoize
    def body(self):
        return json.dumps(
            {
                "fields": self.fields,
                "installationId": self.install.uuid,
            }
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
