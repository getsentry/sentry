from __future__ import annotations

import logging
from typing import Tuple

from django.http import HttpResponse
from django.utils.crypto import constant_time_compare

from sentry.integrations.gitlab.webhooks import handlers
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json

logger = logging.getLogger(__name__)


class GitlabRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.GITLAB]
    webhook_identifier = WebhookProviderIdentifier.GITLAB
    _integration = None

    def _get_external_id(self) -> Tuple[str, str] | HttpResponse:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": self.request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": self.request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        token = "<unknown>"
        try:
            # Munge the token to extract the integration external_id.
            # gitlab hook payloads don't give us enough unique context
            # to find data on our side so we embed one in the token.
            token = self.request.META["HTTP_X_GITLAB_TOKEN"]
            # e.g. "example.gitlab.com:group-x:webhook_secret_from_sentry_integration_table"
            instance, group_path, secret = token.split(":")
            external_id = f"{instance}:{group_path}"
            return (external_id, secret)
        except KeyError:
            logger.info("gitlab.webhook.missing-gitlab-token")
            extra["reason"] = "The customer needs to set a Secret Token in their webhook."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])
        except ValueError:
            logger.info("gitlab.webhook.malformed-gitlab-token", extra=extra)
            extra["reason"] = "The customer's Secret Token is malformed."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])
        except Exception:
            logger.info("gitlab.webhook.invalid-token", extra=extra)
            extra["reason"] = "Generic catch-all error."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

    def _validate_webhook_secret(self, secret: str) -> HttpResponse | None:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": self.request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": self.request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        integration = self.get_integration_from_request()
        try:
            if not constant_time_compare(secret, integration.metadata["webhook_secret"]):
                # Summary and potential workaround mentioned here:
                # https://github.com/getsentry/sentry/issues/34903#issuecomment-1262754478
                # This forces a stack trace to be produced
                raise Exception("The webhook secrets do not match.")
        except Exception:
            logger.info("gitlab.webhook.invalid-token-secret", extra=extra)
            extra[
                "reason"
            ] = "Gitlab's webhook secret does not match. Refresh token (or re-install the integration) by following this https://docs.sentry.io/product/integrations/integration-platform/public-integration/#refreshing-tokens."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

    def _validate_json(self) -> HttpResponse | None:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": self.request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": self.request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        try:
            json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            logger.info("gitlab.webhook.invalid-json", extra=extra)
            extra["reason"] = "Data received is not JSON."
            logger.exception(extra["reason"])
            return HttpResponse(status=400, reason=extra["reason"])

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if self._integration:
            return self._integration
        if not self.is_json_request():
            return None
        try:
            result = self._get_external_id()
            if not isinstance(result, tuple):
                return None
            (external_id, _secret) = result
            self._integration = Integration.objects.filter(
                external_id=external_id, provider=self.provider
            ).first()
            return self._integration
        except Exception:
            return None

    def get_response(self) -> HttpResponse:
        if self.request.method != "POST":
            return HttpResponse(status=405, reason="HTTP method not supported.")
        maybe_http_response = self._get_external_id()
        if isinstance(maybe_http_response, HttpResponse):
            return maybe_http_response
        (_external_id, secret) = maybe_http_response

        if self.request.META["HTTP_X_GITLAB_EVENT"] not in handlers:
            return HttpResponse(
                status=400,
                reason="Webhook event type not supported.",
            )

        response = self._validate_webhook_secret(secret)
        if response:
            return response

        response = self._validate_json()
        if response:
            return response

        # All Gitlab webhooks will be sent to region silos
        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
