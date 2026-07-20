import subprocess
from datetime import timedelta
from urllib.parse import urlparse, urlsplit, urlunparse

import urllib3
from django.conf import settings
from django.http import HttpRequest
from django.urls import reverse
from objectstore_client import (
    Client,
    MetricsBackend,
    Session,
    TimeToIdle,
    TimeToLive,
    TokenGenerator,
    Usecase,
    parse_accept_encoding,
)
from objectstore_client.metrics import Tags

from sentry import options
from sentry.utils import metrics as sentry_metrics
from sentry.utils.env import in_test_environment

__all__ = ["get_attachments_session", "get_debug_files_session", "parse_accept_encoding"]


def default_attachment_retention() -> int:
    """
    Returns the default attachment retention in days, which is used if no
    specific retention is set for an attachment.

    This is determined by the `system.event-retention-days` option, which is the
    same as the default event retention. This ensures that attachments that
    don't declare a retention (e.g. because of a bug) will be retained for at
    least as long as the events, and not get deleted prematurely.
    """
    return int(options.get("system.event-retention-days") or 0) or 30


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


_OBJECTSTORE_CLIENT: Client | None = None
_ATTACHMENTS_USECASE: Usecase | None = None
_DEBUG_FILES_USECASE = Usecase(
    "debug_files", compression="none", expiration_policy=TimeToIdle(timedelta(days=90))
)
_PROFILE_ATTACHMENTS_USECASE: Usecase | None = None
_PREPROD_USECASE = Usecase("preprod", expiration_policy=TimeToIdle(timedelta(days=30)))


def create_client() -> Client:
    options = settings.SENTRY_OBJECTSTORE_CONFIG

    # Initialize the `TokenGenerator` if key parameters are found.
    token_generator = None
    if signing_key_options := options.get("token_generator"):
        # We require the `kid` and `secret_key` keys be set, other options are optional
        if signing_key_options.get("kid") and signing_key_options.get("secret_key"):
            token_generator = TokenGenerator(
                **signing_key_options,
            )

    return Client(
        options["base_url"],
        metrics_backend=SentryMetricsBackend(),
        propagate_traces=options.get("propagate_traces", False),
        retries=options.get("retries", None),
        timeout_ms=options.get("timeout_ms", None),
        connection_kwargs=options.get(
            "connection_kwargs",
            # timeout is a workaround for 0.0.14's default read timeout, can be removed with 0.0.15
            {"timeout": urllib3.Timeout(connect=0.1), "maxsize": 32},
        ),
        token=token_generator,
    )


def get_client() -> Client:
    global _OBJECTSTORE_CLIENT
    if not _OBJECTSTORE_CLIENT:
        _OBJECTSTORE_CLIENT = create_client()
    return _OBJECTSTORE_CLIENT


def get_attachments_usecase() -> Usecase:
    global _ATTACHMENTS_USECASE
    if not _ATTACHMENTS_USECASE:
        retention = default_attachment_retention()
        _ATTACHMENTS_USECASE = Usecase(
            "attachments", expiration_policy=TimeToLive(timedelta(days=retention))
        )
    return _ATTACHMENTS_USECASE


def get_attachments_session(org: int, project: int) -> Session:
    return get_client().session(get_attachments_usecase(), org=org, project=project)


def get_debug_files_session(org: int, project: int) -> Session:
    return get_client().session(_DEBUG_FILES_USECASE, org=org, project=project)


def get_profile_attachments_usecase() -> Usecase:
    # Relay stores raw profiles and their attachments (e.g. Perfetto traces) under
    # the "profile_attachments" usecase, so we must read them back with the same usecase.
    global _PROFILE_ATTACHMENTS_USECASE
    if not _PROFILE_ATTACHMENTS_USECASE:
        retention = default_attachment_retention()
        _PROFILE_ATTACHMENTS_USECASE = Usecase(
            "profile_attachments", expiration_policy=TimeToLive(timedelta(days=retention))
        )
    return _PROFILE_ATTACHMENTS_USECASE


def get_profile_attachments_session(org: int, project: int) -> Session:
    return get_client().session(get_profile_attachments_usecase(), org=org, project=project)


def get_preprod_session(org: int, project: int) -> Session:
    return get_client().session(_PREPROD_USECASE, org=org, project=project)


_IS_SYMBOLICATOR_CONTAINER: bool | None = None


def maybe_rewrite_url_for_symbolicator(url: str) -> str:
    """
    Rewrites a full Objectstore URL so that Symbolicator can reach it.

    In prod, the URL is returned unchanged, as both Sentry and Symbolicator talk to Objectstore
    using the same hostname.

    While in development or testing, we might need to replace the hostname, depending on how
    Symbolicator is running. This function runs a `docker ps` to automatically return the correct
    URL in the following 2 cases:
        - Symbolicator running in Docker (possibly via `devservices`) -- this mirrors `sentry`'s CI.
          If this is detected, we replace Objectstore's hostname with the one reachable in the Docker network.

          Note that this approach doesn't work if Objectstore is running both locally and in Docker, as we'll always
          rewrite the URL to the Docker one, so Sentry and Symbolicator might attempt to talk to 2 different Objectstores.
        - Symbolicator running locally -- this mirrors `symbolicator`'s CI.
          In this case, we don't need to rewrite the URL.
    """
    global _IS_SYMBOLICATOR_CONTAINER  # Cached to avoid running `docker ps` multiple times

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


def get_symbolicator_url(session: Session, key: str) -> str:
    """
    Gets the URL that Symbolicator shall use to access the object at the given key in Objectstore.

    The URL is only rewritten in dev/test mode. See `maybe_rewrite_url_for_symbolicator` for details.
    """
    return maybe_rewrite_url_for_symbolicator(session.object_url(key))


def get_download_redirect_url(request: HttpRequest, session: Session, org: int, key: str) -> str:
    """
    Returns the URL that `request` should be redirected to in order to download the object at `key`
    directly from Objectstore, bypassing Sentry.

    Internal callers (e.g. Symbolicator) are redirected straight to Objectstore's internal URL, while
    external callers are redirected to the cell proxy, which forwards the request to Objectstore.
    """
    from sentry.api.utils import generate_locality_url
    from sentry.auth import system

    presigned_url = session.object_url(key, token_validity=timedelta(minutes=5))

    if system.is_internal_ip(request):
        # Redirect to a URL pointing to the internal Objectstore ip/hostname.
        # In dev/test, we potentially need to rewrite this URL to point to the hostname in the docker network
        # instead, so we need to additionally wrap this with `maybe_rewrite_url_for_symbolicator`.
        # TODO(lcian): Find a more robust way to do this. Here we assume that the caller is Symbolicator,
        # which is currently the case in practice, but in theory it could be any other service.
        return maybe_rewrite_url_for_symbolicator(presigned_url)

    parts = urlsplit(presigned_url)
    proxy_path = reverse(
        "sentry-api-0-organization-objectstore",
        kwargs={
            "organization_id_or_slug": org,
            "path": parts.path.lstrip("/"),
        },
    )
    base = generate_locality_url().rstrip("/")
    return f"{base}{proxy_path}?{parts.query}"
