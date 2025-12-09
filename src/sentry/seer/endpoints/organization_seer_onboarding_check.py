from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.models.repositoryseersettings import RepositorySeerSettings
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


def check_github_integration(organization_id: int) -> bool:
    """Check if the organization has an active GitHub or GitHub Enterprise integration."""
    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization_id,
        providers=[
            IntegrationProviderSlug.GITHUB.value,
            IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        ],
    )

    for organization_integration in organization_integrations:
        integration = integration_service.get_integration(
            organization_integration_id=organization_integration.id, status=ObjectStatus.ACTIVE
        )
        if integration:
            installation = integration.get_installation(organization_id=organization_id)
            if installation:
                return True

    return False


def check_code_review_enabled(organization_id: int) -> bool:
    """Check if code review is enabled for any repository in the organization."""
    repo_ids = Repository.objects.filter(
        organization_id=organization_id, status=ObjectStatus.ACTIVE
    ).values_list("id", flat=True)

    if not repo_ids:
        return False

    return RepositorySeerSettings.objects.filter(
        repository_id__in=repo_ids, enabled_code_review=True
    ).exists()


def check_autofix_enabled(organization_id: int) -> bool:
    """
    Check if autofix/RCA automation is enabled for any project in the organization,
    i.e. if any project in the organization has sentry:autofix_automation_tuning not set to "off".
    """
    projects = Project.objects.filter(
        organization_id=organization_id, status=ObjectStatus.ACTIVE
    ).values_list("id", flat=True)

    if not projects:
        return False

    return (
        ProjectOption.objects.filter(
            project_id__in=projects, key="sentry:autofix_automation_tuning"
        )
        .exclude(value="off")
        .exists()
    )


@region_silo_endpoint
class OrganizationSeerOnboardingCheck(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
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
        """
        Check if the organization has completed Seer onboarding/configuration.
        """
        if not request.user.is_authenticated:
            return Response(status=400)

        has_github_integration = check_github_integration(organization.id)
        is_code_review_enabled = check_code_review_enabled(organization.id)
        is_autofix_enabled = check_autofix_enabled(organization.id)
        is_seer_configured = has_github_integration and (
            is_code_review_enabled or is_autofix_enabled
        )

        return Response(
            {
                "hasGithubIntegration": has_github_integration,
                "isCodeReviewEnabled": is_code_review_enabled,
                "isAutofixEnabled": is_autofix_enabled,
                "isSeerConfigured": is_seer_configured,
            }
        )
