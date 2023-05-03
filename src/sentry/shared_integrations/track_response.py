from __future__ import annotations

import logging

from django.utils.functional import cached_property
from rest_framework.response import Response
from sentry_sdk.tracing import Span

from sentry.utils import metrics


class TrackResponseMixin:
    @property
    def metrics_prefix(self) -> str | None:
        raise NotImplementedError

    @property
    def log_path(self) -> str | None:
        raise NotImplementedError

    @property
    def integration_type(self) -> str | None:
        raise NotImplementedError

    @cached_property  # type: ignore
    def logger(self) -> logging.Logger:
        return logging.getLogger(self.log_path)

    @property
    def name_field(self) -> str:
        return f"{self.integration_type}_name"

    @property
    def name(self) -> str:
        name_: str = getattr(self, self.name_field)
        return name_

    def track_response_data(
        self,
        code: str | int,
        span: Span | None = None,
        error: Exception | None = None,
        resp: Response | None = None,
    ) -> None:
        # if no span was passed, create a dummy to which to add data to avoid having to wrap every
        # span call in `if span`
        span = span or Span()

        metrics.incr(
            f"{self.metrics_prefix}.http_response",
            sample_rate=1.0,
            tags={str(self.integration_type): self.name, "status": code},
        )

        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(str(code))

        extra = {
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        if self.integration_type:
            extra[self.integration_type] = self.name

        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info(f"{self.integration_type}.http_response", extra=extra)
