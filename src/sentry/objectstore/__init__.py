from datetime import timedelta

from objectstore_client import Client, MetricsBackend, Session, TimeToLive, Usecase
from objectstore_client.metrics import Tags

from sentry.utils import metrics as sentry_metrics

__all__ = ["get_attachments_session"]


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


_ATTACHMENTS_CLIENT: Client | None = None
_ATTACHMENTS_USECASE = Usecase("attachments", expiration_policy=TimeToLive(timedelta(days=30)))


def get_attachments_session(org: int, project: int) -> Session:
    global _ATTACHMENTS_CLIENT
    if not _ATTACHMENTS_CLIENT:
        from sentry import options as options_store

        options = options_store.get("objectstore.config")
        _ATTACHMENTS_CLIENT = Client(
            options["base_url"],
            metrics_backend=SentryMetricsBackend(),
        )

    return _ATTACHMENTS_CLIENT.session(_ATTACHMENTS_USECASE, org=org, project=project)
