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
from sentry.models.repositorysettings import RepositorySettings
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


def has_supported_scm_integration(organization_id: int) -> bool:
    """Check if the organization has an active and supported SCM, e.g. GitHub or GitHub Enterprise integration."""
    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization_id,
        providers=[
            IntegrationProviderSlug.GITHUB.value,
            IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        ],
        status=ObjectStatus.ACTIVE,
    )

    return len(organization_integrations) > 0


def is_code_review_enabled(organization_id: int) -> bool:
    """Check if code review is enabled for any active repository in the organization."""
    return RepositorySettings.objects.filter(
        repository__organization_id=organization_id,
        repository__status=ObjectStatus.ACTIVE,
        enabled_code_review=True,
    ).exists()


def is_autofix_enabled(organization_id: int) -> bool:
    """
    Check if autofix/RCA is enabled for any active project in the organization,
    ie, if any project has sentry:autofix_automation_tuning not set to "off" or None.
    """
    return (
        ProjectOption.objects.filter(
            project__organization_id=organization_id,
            project__status=ObjectStatus.ACTIVE,
            key="sentry:autofix_automation_tuning",
        )
        .exclude(value=AutofixAutomationTuningSettings.OFF.value)
        .exclude(value__isnull=True)
        .exists()
    )


@region_silo_endpoint
class OrganizationSeerOnboardingCheck(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
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
        has_scm_integration = has_supported_scm_integration(organization.id)
        code_review_enabled = is_code_review_enabled(organization.id)
        autofix_enabled = is_autofix_enabled(organization.id)
        is_seer_configured = has_scm_integration and (code_review_enabled or autofix_enabled)

        return Response(
            {
                "hasSupportedScmIntegration": has_scm_integration,
                "isCodeReviewEnabled": code_review_enabled,
                "isAutofixEnabled": autofix_enabled,
                "isSeerConfigured": is_seer_configured,
            }
        )
