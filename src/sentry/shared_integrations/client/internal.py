from __future__ import annotations

from typing import Any

from rest_framework.response import Response

from sentry.api.client import ApiClient
from sentry.shared_integrations.track_response import TrackResponseMixin
from sentry.utils import metrics


class BaseInternalApiClient(ApiClient, TrackResponseMixin):
    integration_type: str | None = None

    log_path: str | None = None

    metrics_prefix: str | None = None

    def request(self, *args: Any, **kwargs: Any) -> Response:
        metrics.incr(
            f"{self.metrics_prefix}.http_request",
            sample_rate=1.0,
            tags={str(self.integration_type): self.name},
        )

        resp: Response = ApiClient.request(self, *args, **kwargs)
        self.track_response_data(resp.status_code, None, resp)
        return resp
