from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.projectrepository import ProjectRepository
from sentry.models.repositorysettings import RepositorySettings
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import (
    get_token_based_billing_repo_filter,
    is_seer_seat_based_tier_enabled,
    is_seer_token_based_billing_onboarding_enabled,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.types.ratelimit import RateLimit, RateLimitCategory


def has_supported_scm_integration(organization: Organization) -> bool:
    """Check if the organization has an active and supported SCM, e.g. GitHub or GitHub Enterprise or GitLab integration."""

    providers = [
        IntegrationProviderSlug.GITHUB.value,
        IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        IntegrationProviderSlug.GITLAB.value,
    ]

    if features.has("organizations:seer-cursor-origin-support", organization):
        providers.append(IntegrationProviderSlug.CURSOR_ORIGIN.value)

    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization.id,
        providers=providers,
        status=ObjectStatus.ACTIVE,
    )

    return len(organization_integrations) > 0


def has_code_review_access(organization: Organization) -> bool:
    """Check if the organization's plan lets code review run, mirroring the org check in
    `CodeReviewPreflightService`."""
    return is_seer_seat_based_tier_enabled(organization) or features.has(
        "organizations:code-review-beta", organization
    )


def is_code_review_enabled(organization: Organization) -> bool:
    """Check if code review is enabled for any active repository in the organization."""
    return RepositorySettings.objects.filter(
        repository__organization_id=organization.id,
        repository__status=ObjectStatus.ACTIVE,
        enabled_code_review=True,
    ).exists()


def is_autofix_enabled(organization: Organization) -> bool:
    """Check if any active project in the organization has a repo for autofix/RCA: a usable linked
    repo under token-based billing, otherwise a repo picked in Seer settings."""
    if is_seer_token_based_billing_onboarding_enabled(organization):
        return ProjectRepository.objects.filter(
            get_token_based_billing_repo_filter(organization, prefix="repository__"),
            project__organization_id=organization.id,
            project__status=ObjectStatus.ACTIVE,
        ).exists()

    return SeerProjectRepository.objects.filter(
        project_repository__project__organization_id=organization.id,
        project_repository__project__status=ObjectStatus.ACTIVE,
        project_repository__repository__status=ObjectStatus.ACTIVE,
    ).exists()


@cell_silo_endpoint
class OrganizationSeerOnboardingCheck(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CODING_WORKFLOWS
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=200, window=60, concurrent_limit=20),
                RateLimitCategory.USER: RateLimit(limit=100, window=60, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=1000, window=60, concurrent_limit=100
                ),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        """Check if the organization has completed Seer onboarding/configuration."""
        autofix_enabled = is_autofix_enabled(organization)
        has_scm_integration = has_supported_scm_integration(organization)
        # Repos keep their code review setting after the org loses code review, so the setting
        # alone doesn't mean Seer is set up.
        is_seer_configured = has_scm_integration and (
            autofix_enabled
            or (is_code_review_enabled(organization) and has_code_review_access(organization))
        )

        return Response(
            {
                "hasSupportedScmIntegration": has_scm_integration,
                "isAutofixEnabled": autofix_enabled,
                "isSeerConfigured": is_seer_configured,
            }
        )
