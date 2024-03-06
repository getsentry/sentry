from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from requests import PreparedRequest, Response

from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.integrations.client import ApiClient
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.client import BaseApiResponse
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json, metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"
logger = logging.getLogger(__name__)


class SlackClient(ApiClient):
    allow_redirects = False
    integration_name = "slack"
    base_url = "https://slack.com/api"
    metrics_prefix = "integrations.slack"

    def __init__(
        self,
        integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: Mapping[str, Any] | None = None,
        org_integration_id: int | None = None,  # deprecated but used by getsentry
    ) -> None:
        self.integration_id = integration_id

        super().__init__(
            verify_ssl=verify_ssl,
            integration_id=integration_id,
            logging_context=logging_context,
        )

    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        if "Authorization" in prepared_request.headers or not self.integration_id:
            return prepared_request

        # TODO(hybridcloud) Pass integration into SlackClient.__init__() so
        # we don't have to workaround watermarks here.
        # In order to send requests, SlackClient needs to fetch the integration
        # to get access tokens which trips up rpc method/transaction
        # boundary detection. Those boundaries are not relevant because
        # this is a read operation.
        with in_test_hide_transaction_boundary():
            integration = integration_service.get_integration(
                integration_id=self.integration_id,
                provider=EXTERNAL_PROVIDERS[ExternalProviders.SLACK],
                status=ObjectStatus.ACTIVE,
            )
        if not integration:
            logger.info("no_integration", extra={"path_url": prepared_request.path_url})
            return prepared_request
        token = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        prepared_request.headers["Authorization"] = f"Bearer {token}"
        return prepared_request

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """
        Add request authorization headers
        """
        return self.authorize_request(prepared_request=prepared_request)

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
        log_response_with_error = kwargs.pop("log_response_with_error", False)

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
            if log_response_with_error:
                self.logger.info(
                    "rule.fail.slack_post.log_response", extra={"response": response.__dict__}
                )
            raise ApiError(response.get("error", ""))
        return response
