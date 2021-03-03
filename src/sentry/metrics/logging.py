import logging

from .base import MetricsBackend

logger = logging.getLogger("sentry.metrics")


class LoggingBackend(MetricsBackend):
    def incr(self, key, instance=None, tags=None, amount=1, sample_rate=1):
        logger.debug("%r: %+g", key, amount, extra={"instance": instance, "tags": tags or {}})

    def timing(self, key, value, instance=None, tags=None, sample_rate=1):
        logger.debug(
            "%r: %g ms", key, value * 1000, extra={"instance": instance, "tags": tags or {}}
        )
