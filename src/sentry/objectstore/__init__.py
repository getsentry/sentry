from datetime import timedelta

from objectstore_client import Client, ClientBuilder, ClientError, TimeToLive

from sentry.utils import metrics

__all__ = ["get_attachments_client", "Client", "ClientBuilder", "ClientError"]

_attachments_client: ClientBuilder | None = None


def get_attachments_client() -> ClientBuilder:
    global _attachments_client
    if not _attachments_client:
        from sentry import options as options_store

        options = options_store.get("objectstore.config")
        _attachments_client = ClientBuilder(
            options["base_url"],
            "attachments",
            metrics_backend=metrics,
            default_expiration_policy=TimeToLive(timedelta(days=30)),
        )
    return _attachments_client
