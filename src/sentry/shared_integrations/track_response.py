from __future__ import annotations

import logging
from typing import Any

from django.utils.functional import cached_property
from rest_framework.response import Response

from sentry.utils import metrics


class TrackResponseMixin:
    @property
    def datadog_prefix(self) -> str | None:
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
        span: Any,
        error: Exception | None = None,
        resp: Response | None = None,
    ) -> None:
        metrics.incr(
            f"{self.datadog_prefix}.http_response",
            sample_rate=1.0,
            tags={self.integration_type: self.name, "status": code},
        )

        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(code)

        span.set_tag(self.integration_type, self.name)

        extra = {
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        if self.integration_type:
            extra[self.integration_type] = self.name

        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info(f"{self.integration_type}.http_response", extra=extra)
