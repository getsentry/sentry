from __future__ import annotations

import logging
from collections.abc import Mapping

from django.utils.functional import cached_property
from requests.models import Response

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

    @cached_property
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
        error: Exception | None = None,
        resp: Response | None = None,
        extra: Mapping[str, str] | None = None,
    ) -> None:
        metrics.incr(
            f"{self.metrics_prefix}.http_response",
            sample_rate=1.0,
            tags={str(self.integration_type): self.name, "status": code},
        )

        log_params = {
            **(extra or {}),
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        if self.integration_type:
            log_params[self.integration_type] = self.name

        log_params.update(getattr(self, "logging_context", None) or {})
        self.logger.info("%s.http_response", self.integration_type, extra=log_params)
