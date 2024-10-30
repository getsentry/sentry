import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import TypedDict
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

from django.utils.functional import cached_property
from requests import RequestException
from requests.models import Response

from sentry.sentry_apps.external_requests.utils import send_and_save_sentry_app_request
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.utils import json

DEFAULT_SUCCESS_MESSAGE = "Success!"
DEFAULT_ERROR_MESSAGE = "Something went wrong!"

logger = logging.getLogger("sentry.sentry_apps.external_requests")


class AlertRuleActionResult(TypedDict):
    success: bool
    message: str


@dataclass
class AlertRuleActionRequester:
    install: SentryAppInstallation | RpcSentryAppInstallation
    uri: str
    fields: Sequence[Mapping[str, str]] = field(default_factory=list)
    http_method: str | None = "POST"

    def run(self) -> AlertRuleActionResult:
        try:
            response = send_and_save_sentry_app_request(
                url=self._build_url(),
                sentry_app=self.sentry_app,
                org_id=self.install.organization_id,
                event="alert_rule_action.requested",
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

            return AlertRuleActionResult(
                success=False, message=self._get_response_message(e.response, DEFAULT_ERROR_MESSAGE)
            )
        return AlertRuleActionResult(
            success=True, message=self._get_response_message(response, DEFAULT_SUCCESS_MESSAGE)
        )

    def _build_url(self) -> str:
        urlparts = list(urlparse(self.sentry_app.webhook_url))
        urlparts[2] = self.uri
        return urlunparse(urlparts)

    def _build_headers(self) -> dict[str, str]:
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(self.body),
        }

    def _get_response_message(self, response: Response | None, default_message: str) -> str:
        """
        Returns the message from the response body, if in the expected location.
        Used to bubble up info from the Sentry App to the UI.
        The location should be coordinated with the docs on Alert Rule Action UI Components.
        """
        if response is None:
            message = default_message
        else:
            try:
                message = response.json().get("message", default_message)
            except Exception:
                message = default_message

        return f"{self.sentry_app.name}: {message}"

    @cached_property
    def body(self):
        return json.dumps(
            {
                "fields": self.fields,
                "installationId": self.install.uuid,
            }
        )

    @cached_property
    def sentry_app(self):
        return self.install.sentry_app
