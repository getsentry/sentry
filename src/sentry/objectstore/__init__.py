import subprocess
from datetime import timedelta
from urllib.parse import urlparse, urlunparse

from django.conf import settings
from objectstore_client import Client, MetricsBackend, Session, TimeToLive, Usecase
from objectstore_client.metrics import Tags

from sentry.utils import metrics as sentry_metrics
from sentry.utils.env import in_test_environment

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

_OBJECTSTORE_CLIENT: Client | None = None
_ATTACHMENTS_USECASE = Usecase("attachments", expiration_policy=TimeToLive(timedelta(days=30)))
_PREPROD_USECASE = Usecase("preprod", expiration_policy=TimeToLive(timedelta(days=30)))


def create_client() -> Client:
    from sentry import options as options_store

    options = options_store.get("objectstore.config")
    return Client(
        options["base_url"],
        metrics_backend=SentryMetricsBackend(),
        propagate_traces=options.get("propagate_traces", False),
        retries=options.get("retries", None),
        timeout_ms=options.get("timeout_ms", None),
        connection_kwargs=options.get("connection_kwargs", {}),
    )


def get_attachments_session(org: int, project: int) -> Session:
    global _ATTACHMENTS_CLIENT
    if not _ATTACHMENTS_CLIENT:
        _ATTACHMENTS_CLIENT = create_client()

    return _ATTACHMENTS_CLIENT.session(_ATTACHMENTS_USECASE, org=org, project=project)


def get_preprod_session(org: int, project: int) -> Session:
    global _OBJECTSTORE_CLIENT
    if not _OBJECTSTORE_CLIENT:
        _OBJECTSTORE_CLIENT = create_client()

    return _OBJECTSTORE_CLIENT.session(_PREPROD_USECASE, org=org, project=project)


_IS_SYMBOLICATOR_CONTAINER: bool | None = None


def get_symbolicator_url(session: Session, key: str) -> str:
    """
    Gets the URL that Symbolicator shall use to access the object at the given key in Objectstore.

    In prod, this is simply the `object_url` returned by `objectstore_client`, as both Sentry and Symbolicator
    will talk to Objectstore using the same hostname.

    While in development or testing, we might need to replace the hostname, depending on how Symbolicator is running.
    This function runs a `docker ps` to automatically return the correct URL in the following 2 cases:
        - Symbolicator running in Docker (possibly via `devservices`) -- this mirrors `sentry`'s CI.
          If this is detected, we replace Objectstore's hostname with the one reachable in the Docker network.

          Note that this approach doesn't work if Objectstore is running both locally and in Docker, as we'll always
          rewrite the URL to the Docker one, so Sentry and Symbolicator might attempt to talk to 2 different Objectstores.
        - Symbolicator running locally -- this mirrors `symbolicator`'s CI.
          In this case, we don't need to rewrite the URL.
    """
    global _IS_SYMBOLICATOR_CONTAINER  # Cached to avoid running `docker ps` multiple times

    url = session.object_url(key)
    if not (settings.IS_DEV or in_test_environment()):
        return url

    if _IS_SYMBOLICATOR_CONTAINER is None:
        try:
            docker_ps = subprocess.run(
                ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
            )
            _IS_SYMBOLICATOR_CONTAINER = "symbolicator" in docker_ps.stdout
        except Exception:
            _IS_SYMBOLICATOR_CONTAINER = False

    if not _IS_SYMBOLICATOR_CONTAINER:
        return url

    replacement = "objectstore"
    parsed = urlparse(url)
    if parsed.port:
        replacement += f":{parsed.port}"
    updated = parsed._replace(netloc=replacement)
    return urlunparse(updated)
