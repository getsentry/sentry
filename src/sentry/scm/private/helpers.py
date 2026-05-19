from typing import cast

import sentry_sdk
from django.db.models import Q
from scm.providers.github.provider import GitHubProvider
from scm.providers.gitlab.provider import GitLabProvider
from scm.rate_limit import RateLimitProvider
from scm.types import Provider, Repository, RepositoryId

from sentry.constants import ObjectStatus
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.rate_limit import RedisRateLimitProvider
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils import metrics


def fetch_service_provider(
    organization_id: int,
    repository: Repository,
    rate_limit_provider: RateLimitProvider | None = None,
) -> Provider | None:
    integration = integration_service.get_integration(
        integration_id=repository["integration_id"],
        organization_id=organization_id,
    )
    if not integration:
        return None

    try:
        client = integration.get_installation(organization_id=organization_id).get_client()
    except (IntegrationError, OrganizationIntegrationNotFound):
        return None

    if integration.provider == "github":
        return GitHubProvider(
            client,
            organization_id,
            repository,
            rate_limit_provider=rate_limit_provider or RedisRateLimitProvider(),
        )
    elif integration.provider == "gitlab":
        return GitLabProvider(client, organization_id, repository)
    else:
        return None


def fetch_repository(organization_id: int, repository_id: RepositoryId) -> Repository | None:
    try:
        if isinstance(repository_id, int):
            repo = RepositoryModel.objects.get(organization_id=organization_id, id=repository_id)
        else:
            repo = RepositoryModel.objects.get(
                Q(external_id=repository_id[1]) | Q(name=repository_id[1]),
                organization_id=organization_id,
                provider=f"integrations:{repository_id[0]}",
            )
    except RepositoryModel.DoesNotExist:
        return None

    # This state should be impossible, however, the invariant is not encoded into the data type.
    # If we encounter a null integration_id the repository is useless. Return "None" and let the
    # SCM fail gracefully. Failing to return "None" here could fetch _any_ integration belonging
    # to the organization.
    if not isinstance(repo.integration_id, int):
        return None

    # This state should be impossible, however, the invariant is not encoded into the data type.
    # If we encounter a null provider the repository is functionally useless and there is a
    # broader bug in the Sentry codebase. Return "None" and let the SCM fail gracefully.
    if not isinstance(repo.provider, str):
        return None

    return cast(
        Repository,
        {
            "external_id": repo.external_id,
            "id": repo.id,
            "integration_id": repo.integration_id,
            "is_active": repo.status == ObjectStatus.ACTIVE,
            "name": repo.name,
            "organization_id": repo.organization_id,
            "provider_name": repo.provider.removeprefix("integrations:"),
            "web_base_url": None,
        },
    )


def report_error_to_sentry(e: Exception) -> None:
    """Typing wrapper around sentry_sdk.capture_exception."""
    sentry_sdk.capture_exception(e)


def record_count_metric(key: str, amount: int, tags: dict[str, str]) -> None:
    """Typing wrapper around metrics.incr."""
    metrics.incr(key, amount, tags=tags)


def record_distribution_metric(key: str, amount: int, tags: dict[str, str], unit: str) -> None:
    """Typing wrapper around metrics.distribution."""
    metrics.distribution(key, amount, tags=tags, unit=unit)


def record_timer_metric(key: str, amount: float, tags: dict[str, str]) -> None:
    """Typing wrapper around metrics.distribution."""
    metrics.distribution(key, amount, tags=tags)
