import logging
from typing import Optional, Union

from .base import MetricsBackend, Tags

logger = logging.getLogger("sentry.metrics")


class LoggingBackend(MetricsBackend):
    def incr(
        self,
        key: str,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        amount: Union[float, int] = 1,
        sample_rate: float = 1,
    ) -> None:
        logger.debug("%r: %+g", key, amount, extra={"instance": instance, "tags": tags or {}})

    def timing(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        logger.debug(
            "%r: %g ms", key, value * 1000, extra={"instance": instance, "tags": tags or {}}
        )

    def gauge(
        self,
        key: str,
        value: float,
        instance: Optional[str] = None,
        tags: Optional[Tags] = None,
        sample_rate: float = 1,
    ) -> None:
        logger.debug("%r: %+g", key, value, extra={"instance": instance, "tags": tags or {}})
