import logging
import time
from typing import cast

import sentry_sdk
from django.db.models import Q
from scm.errors import RateLimitExceeded, ResourceForbidden, SCMCodedError
from scm.providers.github.provider import GitHubProvider
from scm.providers.gitlab.provider import GitLabProvider
from scm.rate_limit import RateLimitProvider
from scm.types import Provider, Repository, RepositoryId

from sentry.constants import ObjectStatus
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.github.client import GITHUB_RATE_LIMIT_WINDOW, REFERRER_ALLOCATION
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.rate_limit import DynamicRateLimiter, RedisRateLimitProvider
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# SCMCodedError subclasses that represent expected external conditions (ACL
# restrictions, rate limits, etc.) rather than application defects. These are
# surfaced as warnings in the application log instead of being captured as
# Sentry error events, which would pollute the error stream and obscure real
# defects.
_EXPECTED_EXTERNAL_CONDITION_TYPES = (
    ResourceForbidden,
    RateLimitExceeded,
)


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

    if integration.provider in ("github", "github_enterprise"):
        rate_limiter = DynamicRateLimiter(
            get_time_in_seconds=lambda: int(time.time()),
            integration_id=integration.id,
            provider=integration.provider,
            rate_limit_provider=rate_limit_provider or RedisRateLimitProvider(),
            rate_limit_window_seconds=GITHUB_RATE_LIMIT_WINDOW,
            referrer_allocation=REFERRER_ALLOCATION,
        )
        return GitHubProvider(client, organization_id, repository, rate_limiter=rate_limiter)
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

    provider_name = repo.provider.removeprefix("integrations:")
    web_base_url: str | None = None
    if provider_name == "github_enterprise":
        integration = integration_service.get_integration(
            integration_id=repo.integration_id,
            organization_id=organization_id,
        )
        if integration:
            domain_name = integration.metadata.get("domain_name")
            if domain_name:
                base_host = domain_name.split("/", 1)[0]
                web_base_url = f"https://{base_host}"

    return cast(
        Repository,
        {
            "external_id": repo.external_id,
            "id": repo.id,
            "integration_id": repo.integration_id,
            "is_active": repo.status == ObjectStatus.ACTIVE,
            "name": repo.name,
            "organization_id": repo.organization_id,
            "provider_name": provider_name,
            "web_base_url": web_base_url,
        },
    )


def report_error_to_sentry(e: Exception) -> None:
    """Capture an SCM RPC exception as a Sentry error event, or log it as a
    warning when it represents an expected external condition.

    IP allowlists, ACL restrictions (ResourceForbidden), and rate limits
    (RateLimitExceeded) are set by the upstream service-provider or the
    customer organization and are not application defects. Capturing them as
    Sentry errors would pollute the error stream and make real defects harder
    to find. They are logged at WARNING instead so they remain observable
    without creating noise.

    All other exceptions — including SCMCodedError subclasses for unexpected
    responses and unhandled provider exceptions — are captured normally.
    """
    if isinstance(e, _EXPECTED_EXTERNAL_CONDITION_TYPES):
        logger.warning(
            "scm.rpc.expected_external_condition",
            extra={
                "error_code": e.code if isinstance(e, SCMCodedError) else None,
                "detail": e.detail if isinstance(e, SCMCodedError) else str(e),
            },
        )
        return
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
