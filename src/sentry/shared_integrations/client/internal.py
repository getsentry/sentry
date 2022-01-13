from random import random

import sentry_sdk

from sentry.api import ApiClient
from sentry.shared_integrations.track_response import TrackResponseMixin
from sentry.utils import metrics


class BaseInternalApiClient(ApiClient, TrackResponseMixin):
    integration_type = None

    log_path = None

    datadog_prefix = None

    def request(self, *args, **kwargs):
        metrics.incr(
            "%s.http_request" % self.datadog_prefix,
            sample_rate=1.0,
            tags={self.integration_type: self.name},
        )

        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http",
            name=f"{self.integration_type}.http_response.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=random() < 0.05,
        ) as span:
            resp = ApiClient.request(self, *args, **kwargs)
            self.track_response_data(resp.status_code, span, None, resp)
            return resp
