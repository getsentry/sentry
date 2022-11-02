from __future__ import annotations

from random import random
from typing import Any

import sentry_sdk
from rest_framework.response import Response

from sentry.api import ApiClient
from sentry.shared_integrations.track_response import TrackResponseMixin
from sentry.utils import metrics


class BaseInternalApiClient(ApiClient, TrackResponseMixin):  # type: ignore
    integration_type: str | None = None

    log_path: str | None = None

    metrics_prefix: str | None = None

    def request(self, *args: Any, **kwargs: Any) -> Response:
        metrics.incr(
            f"{self.metrics_prefix}.http_request",
            sample_rate=1.0,
            tags={str(self.integration_type): self.name},
        )

        with sentry_sdk.configure_scope() as scope:
            if scope.span is not None:
                parent_span_id: str | None = scope.span.span_id
                trace_id: str | None = scope.span.trace_id
            else:
                parent_span_id = None
                trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http",
            name=f"{self.integration_type}.http_response.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=random() < 0.05,
        ) as span:
            resp: Response = ApiClient.request(self, *args, **kwargs)
            self.track_response_data(resp.status_code, span, None, resp)
            return resp
