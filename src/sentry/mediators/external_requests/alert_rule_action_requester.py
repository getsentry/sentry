import logging
from typing import Mapping, Union
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

from sentry.http import safe_urlread
from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests.util import send_and_save_sentry_app_request
from sentry.utils import json
from sentry.utils.cache import memoize

logger = logging.getLogger("sentry.mediators.external-requests")

DEFAULT_SUCCESS_MESSAGE = "Success!"
DEFAULT_ERROR_MESSAGE = "Something went wrong!"


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

    def _make_request(self) -> Mapping[str, Union[bool, str]]:

        try:
            req = send_and_save_sentry_app_request(
                self._build_url(),
                self.sentry_app,
                self.install.organization_id,
                "alert_rule_action.requested",
                headers=self._build_headers(),
                method=self.http_method,
                data=self.body,
            )
        except Exception as e:
            logger.info(
                "alert_rule_action.error",
                extra={
                    "sentry_app_slug": self.sentry_app.slug,
                    "install_uuid": self.install.uuid,
                    "uri": self.uri,
                    "error_message": str(e),
                },
            )
            message = f"{self.sentry_app.name}: {str(e.response.text) or DEFAULT_ERROR_MESSAGE}"
            # Bubble up error message from Sentry App to the UI for the user.
            return {"success": False, "message": message}

        body_raw = safe_urlread(req)
        body = body_raw.decode() if body_raw else None
        message = f"{self.sentry_app.name}: {body or DEFAULT_SUCCESS_MESSAGE}"
        return {"success": True, "message": message}

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
