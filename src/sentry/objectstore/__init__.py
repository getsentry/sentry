from typing import int
from datetime import timedelta

from objectstore_client import Client, ClientBuilder, ClientError, MetricsBackend, TimeToLive
from objectstore_client.metrics import Tags

from sentry.utils import metrics as sentry_metrics

__all__ = ["get_attachments_client", "Client", "ClientBuilder", "ClientError"]

_attachments_client: ClientBuilder | None = None


class SentryMetricsBackend(MetricsBackend):
    def increment(
        self,
        name: str,
        value: int | float = 1,
        tags: Tags | None = None,
    ) -> None:
        sentry_metrics.incr(name, int(value), tags=tags)

    def gauge(self, name: str, value: int | float, tags: Tags | None = None) -> None:
        """
        Sets a gauge metric to the given value.
        """
        sentry_metrics.gauge(name, value, tags=tags)

    def distribution(
        self,
        name: str,
        value: int | float,
        tags: Tags | None = None,
        unit: str | None = None,
    ) -> None:
        sentry_metrics.distribution(name, value, tags=tags, unit=unit)


def get_attachments_client() -> ClientBuilder:
    global _attachments_client
    if not _attachments_client:
        from sentry import options as options_store

        options = options_store.get("objectstore.config")
        _attachments_client = ClientBuilder(
            options["base_url"],
            "attachments",
            metrics_backend=SentryMetricsBackend(),
            default_expiration_policy=TimeToLive(timedelta(days=30)),
        )
    return _attachments_client
