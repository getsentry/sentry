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


_ATTACHMENTS = Usecase("attachments", expiration_policy=TimeToLive(timedelta(days=30)))
_ATTACHMENTS_SESSION: Session | None = None


def get_attachments_session(org: int, project: int) -> Session:
    global _ATTACHMENTS_SESSION
    if not _ATTACHMENTS_SESSION:
        from sentry import options as options_store

        options = options_store.get("objectstore.config")
        client = Client(
            options["base_url"],
            metrics_backend=SentryMetricsBackend(),
        )
        _ATTACHMENTS_SESSION = client.session(_ATTACHMENTS, org=org, project=project)

    return _ATTACHMENTS_SESSION
