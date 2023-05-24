from __future__ import annotations

import logging
from typing import Any, Mapping, Optional, Union

from requests import PreparedRequest, Response
from sentry_sdk.tracing import Span

from sentry.constants import ObjectStatus
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client import BaseApiResponse
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"
logger = logging.getLogger(__name__)


class SlackClient(IntegrationProxyClient):
    allow_redirects = False
    integration_name = "slack"
    base_url = "https://slack.com/api"
    metrics_prefix = "integrations.slack"

    def __init__(
        self,
        integration_id: int | None = None,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
    ) -> None:
        # The IntegrationProxyClient requires org_integration context to proxy requests properly
        # but the SlackClient is not often invoked within the context of an organization. This work
        # around ensures one is always provided
        self.integration_id = integration_id
        if not org_integration_id and integration_id is not None:
            org_integrations = integration_service.get_organization_integrations(
                integration_id=self.integration_id
            )
            if len(org_integrations) > 0:
                org_integration_id = org_integrations[0].id

        super().__init__(org_integration_id, verify_ssl, logging_context)

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        integration = None
        base_qs = {
            "provider": EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
            "status": ObjectStatus.ACTIVE,
        }
        if self.integration_id:
            integration = Integration.objects.filter(id=self.integration_id, **base_qs).first()
        elif self.org_integration_id:
            integration = Integration.objects.filter(
                organizationintegration__id=self.org_integration_id, **base_qs
            ).first()

        if not integration:
            logger.info("no_integration", extra={"path_url": prepared_request.path_url})
            return prepared_request

        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        prepared_request.headers["Authorization"] = f"Bearer {token}"
        return prepared_request

    def track_response_data(
        self,
        code: Union[str, int],
        span: Span | None = None,
        error: Optional[str] = None,
        resp: Optional[Response] = None,
    ) -> None:
        # if no span was passed, create a dummy to which to add data to avoid having to wrap every
        # span call in `if span`
        span = span or Span()

        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(str(code))

        is_ok = False
        # If Slack gives us back a 200 we still want to check the 'ok' param
        if resp:
            content_type = resp.headers["content-type"]
            if content_type == "text/html":
                is_ok = str(resp.content) == "ok"
                # If there is an error, Slack just makes the error the entire response.
                error_option = resp.content

            else:
                # The content-type should be "application/json" at this point but we don't check.
                response = resp.json()
                is_ok = response.get("ok")
                error_option = response.get("error")

            span.set_tag("ok", is_ok)

            # when 'ok' is False, we can add the error we get back as a tag
            if not is_ok:
                span.set_tag("slack_error", error_option)

        metrics.incr(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": is_ok, "status": code},
        )

        extra = {
            self.integration_type: self.name,
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info(f"{self.integration_type}.http_response", extra=extra)

    def request(
        self,
        method: str,
        path: str,
        headers: Optional[Mapping[str, str]] = None,
        data: Optional[Mapping[str, Any]] = None,
        params: Optional[Mapping[str, Any]] = None,
        json: bool = False,
        timeout: Optional[int] = None,
    ) -> BaseApiResponse:
        response: BaseApiResponse = self._request(
            method, path, headers=headers, data=data, params=params, json=json
        )
        if not response.json.get("ok"):
            raise ApiError(response.get("error", ""))  # type: ignore
        return response
