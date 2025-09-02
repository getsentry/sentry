import logging

from .base import MetricsBackend, Tags

logger = logging.getLogger("sentry.metrics")


class LoggingBackend(MetricsBackend):
    def incr(
        self,
        key: str,
        instance: str | None = None,
        tags: Tags | None = None,
        amount: float | int = 1,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        logger.debug("%r: %+g", key, amount, extra={"instance": instance, "tags": tags or {}})

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        logger.debug(
            "%r: %g ms", key, value * 1000, extra={"instance": instance, "tags": tags or {}}
        )

    def gauge(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        logger.debug("%r: %+g", key, value, extra={"instance": instance, "tags": tags or {}})

    def distribution(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        logger.debug("%r: %+g", key, value, extra={"instance": instance, "tags": tags or {}})

    def event(
        self,
        title: str,
        message: str,
        alert_type: str | None = None,
        aggregation_key: str | None = None,
        source_type_name: str | None = None,
        priority: str | None = None,
        instance: str | None = None,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        logger.debug("%r: %+g", title, message, extra={"instance": instance, "tags": tags or {}})
