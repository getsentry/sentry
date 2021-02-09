from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics

SLACK_DATADOG_METRIC = "integrations.slack.http_response"


class SlackClient(ApiClient):
    allow_redirects = False
    integration_name = "slack"
    base_url = "https://slack.com/api"
    datadog_prefix = "integrations.slack"

    def track_response_data(self, code, span, error=None, resp=None):
        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(code)

        span.set_tag("integration", "slack")

        is_ok = False
        # If Slack gives us back a 200 we still want to check the 'ok' param
        if resp:
            response = resp.json()
            is_ok = response.get("ok")
            span.set_tag("ok", is_ok)

            # when 'ok' is False, we can add the error we get back as a tag
            if not is_ok:
                error = response.get("error")
                span.set_tag("slack_error", error)

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
        self.logger.info("%s.http_response" % (self.integration_type), extra=extra)

    def request(self, method, path, headers=None, data=None, params=None, json=False, timeout=None):
        # TODO(meredith): Slack actually supports json now for the chat.postMessage so we
        # can update that so we don't have to pass json=False here
        response = self._request(method, path, headers=headers, data=data, params=params, json=json)
        if not response.json.get("ok"):
            raise ApiError(response.get("error", ""))
        return response
