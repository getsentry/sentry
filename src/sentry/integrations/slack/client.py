from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from requests import PreparedRequest, Response

from sentry.constants import ObjectStatus
from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client import BaseApiResponse
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json, metrics

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
        self.integration_id = integration_id
        if not org_integration_id and integration_id is not None:
            org_integration_id = infer_org_integration(
                integration_id=self.integration_id, ctx_logger=logger
            )

        super().__init__(
            org_integration_id=org_integration_id,
            verify_ssl=verify_ssl,
            integration_id=integration_id,
            logging_context=logging_context,
        )

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

    def is_response_fatal(self, response: Response) -> bool:
        try:
            resp_json = response.json()
            if not resp_json.get("ok"):
                if "account_inactive" == resp_json.get("error", ""):
                    return True
            return False
        except json.JSONDecodeError:
            return False

    def track_response_data(
        self,
        code: str | int,
        error: str | None = None,
        resp: Response | None = None,
        extra: Mapping[str, str] | None = None,
    ) -> None:
        is_ok = False
        # If Slack gives us back a 200 we still want to check the 'ok' param
        if resp:
            content_type = resp.headers["content-type"]
            if content_type == "text/html":
                is_ok = str(resp.content) == "ok"

            else:
                # The content-type should be "application/json" at this point but we don't check.
                response = resp.json()
                is_ok = response.get("ok")

        metrics.incr(
            SLACK_DATADOG_METRIC,
            sample_rate=1.0,
            tags={"ok": is_ok, "status": code},
        )

        extra = {
            **(extra or {}),
            self.integration_type: self.name,
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info("%s.http_response", self.integration_type, extra=extra)

    def request(
        self,
        method: str,
        path: str,
        headers: Mapping[str, str] | None = None,
        data: Mapping[str, Any] | None = None,
        params: Mapping[str, Any] | None = None,
        json: bool = False,
        timeout: int | None = None,
        raw_response: bool = False,
        *args: Any,
        **kwargs: Any,
    ) -> BaseApiResponse:
        response = self._request(
            method,
            path,
            headers=headers,
            data=data,
            params=params,
            json=json,
            raw_response=raw_response,
            *args,
            **kwargs,
        )
        if not raw_response and not response.json.get("ok"):
            raise ApiError(response.get("error", ""))
        return response
