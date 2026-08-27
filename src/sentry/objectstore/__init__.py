from __future__ import annotations

import subprocess
from datetime import timedelta
from enum import Enum
from typing import TYPE_CHECKING
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
    parse_accept_encoding,
)
from objectstore_client import (
    Usecase as ObjectstoreClientUsecase,
)
from objectstore_client.metrics import Tags

from sentry import options
from sentry.utils import metrics as sentry_metrics
from sentry.utils.env import in_test_environment

if TYPE_CHECKING:
    from sentry.models.project import Project

__all__ = ["UsecaseId", "get_session", "parse_accept_encoding"]


# Default validity of the token used for redirecting to Objectstore. This is a
# short-lived token, as it is only used for a single request.
REDIRECT_VALIDITY = timedelta(minutes=5)


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


class UsecaseId(Enum):
    """Objectstore workloads and their default configuration.

    Use this enum with ``get_session`` instead of constructing a client usecase
    directly. This configures the correct expiration policy and other usecase
    settings.
    """

    ATTACHMENTS = "attachments"
    DEBUG_FILES = "debug_files"
    PROFILE_ATTACHMENTS = "profile_attachments"
    PREPROD = "preprod"

    def create(self) -> ObjectstoreClientUsecase:
        match self:
            case UsecaseId.ATTACHMENTS:
                return ObjectstoreClientUsecase(
                    self.value,
                    expiration_policy=TimeToLive(timedelta(days=default_attachment_retention())),
                )
            case UsecaseId.DEBUG_FILES:
                return ObjectstoreClientUsecase(
                    self.value,
                    compression="none",
                    expiration_policy=TimeToIdle(timedelta(days=90)),
                )
            case UsecaseId.PROFILE_ATTACHMENTS:
                return ObjectstoreClientUsecase(
                    self.value,
                    expiration_policy=TimeToLive(timedelta(days=default_attachment_retention())),
                )
            case UsecaseId.PREPROD:
                return ObjectstoreClientUsecase(
                    self.value,
                    expiration_policy=TimeToIdle(timedelta(days=30)),
                )


def _create_client() -> Client:
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
            {"timeout": urllib3.Timeout(connect=5.0, read=None), "maxsize": 32},
        ),
        token=token_generator,
    )


_CLIENT: Client | None = None


def _get_client() -> Client:
    global _CLIENT
    if not _CLIENT:
        _CLIENT = _create_client()
    return _CLIENT


_USECASES: dict[UsecaseId, ObjectstoreClientUsecase] = {}


def get_session(usecase: UsecaseId, project: Project | int, *, org: int | None = None) -> Session:
    """Return an Objectstore session scoped to a project.

    There are two ways to construct a session:
    - Project model: ``get_session(UsecaseId.ATTACHMENTS, project)``
    - Project and org IDs: ``get_session(UsecaseId.ATTACHMENTS, project_id, org=org_id)``

    When passing a project model, ``org`` is optional and must match the
    project's organization. It is required when passing a project ID.
    """
    if isinstance(project, int):
        if org is None:
            raise TypeError("org is required when project is an ID")
        project_id = project
        org_id = org
    else:
        project_id = project.id
        org_id = project.organization_id
        if org is not None and org != org_id:
            raise ValueError("project does not belong to org")

    objectstore_usecase = _USECASES.get(usecase)
    if objectstore_usecase is None:
        objectstore_usecase = usecase.create()
        _USECASES[usecase] = objectstore_usecase

    return _get_client().session(objectstore_usecase, org=org_id, project=project_id)


_IS_SYMBOLICATOR_CONTAINER: bool | None = None


def _maybe_rewrite_internal_url(url: str) -> str:
    """
    Rewrites a full Objectstore URL so that an internal service can reach it.

    In production, the URL is returned unchanged, as both Sentry and internal
    services talk to Objectstore using the same hostname.

    While in development or testing, we might need to replace the hostname,
    depending on how Symbolicator is running. This function runs a `docker ps`
    to automatically return the correct URL in the following 2 cases:
        - Symbolicator running in Docker (possibly via `devservices`) -- this
          mirrors `sentry`'s CI. If this is detected, we replace Objectstore's
          hostname with the one reachable in the Docker network.

          Note that this approach doesn't work if Objectstore is running both
          locally and in Docker, as we'll always rewrite the URL to the Docker
          one, so Sentry and Symbolicator might attempt to talk to 2 different
          Objectstores.
        - Symbolicator running locally -- this mirrors `symbolicator`'s CI. In
          this case, we don't need to rewrite the URL.
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


def get_internal_download_url(
    session: Session, key: str, token_validity: timedelta | None = None
) -> str:
    """
    Pre-signed URL to `key` for an INTERNAL service (e.g. Symbolicator, teapot): a direct link to
    Objectstore that bypasses the cell proxy.
    """
    if token_validity is None:
        token_validity = REDIRECT_VALIDITY

    # Redirect to a URL pointing to the internal Objectstore ip/hostname.
    # In dev/test, we potentially need to rewrite this URL to point to the hostname in the docker network
    # instead, so we need to additionally wrap this with `maybe_rewrite_url_for_symbolicator`.
    # TODO(lcian): Find a more robust way to do this. Here we assume that the caller is Symbolicator,
    # which is currently the case in practice, but in theory it could be any other service.
    return _maybe_rewrite_internal_url(session.object_url(key, token_validity=token_validity))


def get_download_redirect_url(
    request: HttpRequest,
    session: Session,
    org: int,
    key: str,
    token_validity: timedelta | None = None,
) -> str:
    """
    Returns the URL that `request` should be redirected to in order to download the object at `key`
    directly from Objectstore, bypassing Sentry.

    Internal callers (e.g. Symbolicator) are redirected straight to Objectstore's internal URL, while
    external callers are redirected to the cell proxy, which forwards the request to Objectstore.
    """
    from sentry.api.utils import generate_locality_url
    from sentry.auth import system

    if system.is_internal_ip(request):
        return get_internal_download_url(session, key, token_validity)

    if token_validity is None:
        token_validity = REDIRECT_VALIDITY

    presigned_url = session.object_url(key, token_validity=token_validity)

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
