from typing import Any, Mapping, Optional, Union

from requests import Response
from sentry_sdk.tracing import Transaction

from sentry.integrations.client import ApiClient
from sentry.shared_integrations.client import BaseApiResponse
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"


class SlackClient(ApiClient):  # type: ignore
    allow_redirects = False
    integration_name = "slack"
    base_url = "https://slack.com/api"
    datadog_prefix = "integrations.slack"

    def track_response_data(
        self,
        code: Union[str, int],
        span: Transaction,
        error: Optional[str] = None,
        resp: Optional[Response] = None,
    ) -> None:
        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(code)

        span.set_tag("integration", "slack")

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
        # TODO(meredith): Slack actually supports json now for the chat.postMessage so we
        # can update that so we don't have to pass json=False here
        response = self._request(method, path, headers=headers, data=data, params=params, json=json)
        if not response.json.get("ok"):
            raise ApiError(response.get("error", ""))
        return response
