from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from datetime import timedelta

from django.db import models
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import ExternalActorSource, ExternalProviders
from sentry.models.commitauthor import CommitAuthor
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)

# How long before we'll re-query an author's public GitHub profile email.
PUBLIC_EMAIL_QUERY_TTL = timedelta(days=30)

NOREPLY_SUFFIX = "@users.noreply.github.com"

_PROVIDER_BY_PREFIX = {
    "github": ExternalProviders.GITHUB.value,
    "github_enterprise": ExternalProviders.GITHUB_ENTERPRISE.value,
}


@instrumented_task(
    name="sentry.integrations.github.tasks.query_commit_author_public_emails",
    namespace=integrations_tasks,
    processing_deadline_duration=120,
    retry=Retry(times=3, delay=60, on=(ApiError,)),
    silo_mode=SiloMode.CELL,
)
def query_commit_author_public_emails(
    organization_id: int,
    integration_id: int,
    commit_author_ids: Sequence[int],
) -> None:
    """Query commit authors' public GitHub profile emails and, when one resolves
    to a Sentry user, create the corresponding ExternalActor mapping.

    This is run out-of-band (via ``apply_async``) from the commit ingestion
    webhook because querying the SCM API is slow and consumes GitHub rate
    limits. Each author is gated on ``CommitAuthor.public_email_queried_at`` so
    we only spend a request when there's a realistic chance of producing a
    mapping we don't already have.
    """
    if not commit_author_ids:
        return

    # The caller (GitHub/GHE push webhook) already knows the integration is a
    # GitHub one, so we don't re-check the provider here; we just need to confirm
    # it's still active and grab a client.
    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        return

    installation = integration.get_installation(organization_id=organization_id)
    try:
        client = installation.get_client()
    except Exception:
        logger.warning(
            "github.query_commit_author_public_emails.no_client",
            extra={"organization_id": organization_id, "integration_id": integration_id},
        )
        return

    cutoff = timezone.now() - PUBLIC_EMAIL_QUERY_TTL
    authors = (
        CommitAuthor.objects.filter(
            organization_id=organization_id,
            id__in=list(commit_author_ids),
        )
        .filter(
            models.Q(public_email_queried_at__isnull=True)
            | models.Q(public_email_queried_at__lt=cutoff)
        )
        .filter(
            models.Q(external_id__startswith="github:")
            | models.Q(external_id__startswith="github_enterprise:")
        )
    )

    interval = options.get("integrations.backfill_github_external_actor.gh_api_fetch_interval_s")

    for author in authors:
        username = author.get_username_from_external_id()
        if not username or not author.external_id:
            continue
        prefix = author.external_id.split(":", 1)[0]
        provider = _PROVIDER_BY_PREFIX.get(prefix, ExternalProviders.GITHUB.value)

        t0 = time.monotonic()
        try:
            profile = client.get_user(username)
        except ApiError as e:
            if installation.is_rate_limited_error(e):
                logger.info(
                    "github.query_commit_author_public_emails.rate_limited",
                    extra={"organization_id": organization_id},
                )
                # Re-raise so the task retries later. We intentionally don't
                # stamp public_email_queried_at, leaving remaining authors
                # eligible on the retry.
                raise
            # Only stamp on terminal client errors (e.g. 404) where the profile
            # genuinely won't resolve. Transient errors (5xx, 401/403 auth
            # failures, timeouts, connection issues with no status code) mean we
            # never learned anything about this profile, so skip without
            # stamping to keep the author eligible for a future attempt rather
            # than excluding it for PUBLIC_EMAIL_QUERY_TTL.
            if e.code is None or e.code >= 500 or e.code in (401, 403):
                logger.info(
                    "github.query_commit_author_public_emails.transient_error",
                    extra={
                        "organization_id": organization_id,
                        "commit_author_id": author.id,
                        "code": e.code,
                    },
                )
                continue
            author.update(public_email_queried_at=timezone.now())
            continue
        finally:
            remaining = interval - (time.monotonic() - t0)
            if remaining > 0:
                time.sleep(remaining)

        author.update(public_email_queried_at=timezone.now())

        email = (profile.get("email") or "").strip().lower()
        if not email or email.endswith(NOREPLY_SUFFIX):
            continue

        users = user_service.get_many_by_email(
            emails=[email],
            is_verified=True,
            is_active=True,
            organization_id=organization_id,
        )
        # A high-signal mapping is one verified email -> one Sentry user. If the
        # email is shared by multiple org users we can't safely pick one, so we
        # skip rather than create ambiguous mappings.
        if len(users) != 1:
            continue

        user_id = users[0].id
        gh_id = str(profile["id"]) if profile.get("id") else None
        external_name = f"@{username}"
        try:
            # GitHub usernames are case-insensitive, so match existing rows
            # case-insensitively (consistent with the external_actor API
            # serializer and sync.py) to avoid creating duplicate mappings that
            # differ only in casing. The canonical casing is stored via defaults.
            _, created = ExternalActor.objects.get_or_create(
                organization_id=organization_id,
                provider=provider,
                external_name__iexact=external_name,
                user_id=user_id,
                defaults={
                    "external_name": external_name,
                    "integration_id": integration_id,
                    "external_id": gh_id,
                    "source": ExternalActorSource.SCM_API.value,
                },
            )
        except Exception:
            logger.exception(
                "github.query_commit_author_public_emails.write_failed",
                extra={
                    "organization_id": organization_id,
                    "commit_author_id": author.id,
                    "user_id": user_id,
                },
            )
            continue
