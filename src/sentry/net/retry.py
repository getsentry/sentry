import logging
from types import TracebackType
from typing import Any, Self

from urllib3 import BaseHTTPResponse
from urllib3.connectionpool import ConnectionPool
from urllib3.util.retry import Retry

default_logger = logging.getLogger(__name__)


class LoggedRetry(Retry):
    def __init__(self, logger: logging.Logger | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.logger = logger or default_logger

    def increment(
        self,
        method: str | None = None,
        url: str | None = None,
        response: BaseHTTPResponse | None = None,
        error: Exception | None = None,
        _pool: ConnectionPool | None = None,
        _stacktrace: TracebackType | None = None,
    ) -> Self:
        # Increment uses Retry.new to instantiate a new instance so we need to
        # manually propagate the logger as it can't be passed through increment.
        retry = super().increment(
            method=method,
            url=url,
            response=response,
            error=error,
            _pool=_pool,
            _stacktrace=_stacktrace,
        )
        retry.logger = self.logger

        extra: dict[str, str | int | None] = {
            "request_method": method,
            "request_url": url,
            "retry_total_remaining": retry.total,
        }
        if response is not None:
            extra["response_status"] = response.status
        if error is not None:
            extra["error"] = error.__class__.__name__

        self.logger.info("Request retried", extra=extra)

        return retry
