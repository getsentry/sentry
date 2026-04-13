from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repositorysettings import RepositorySettings
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import bulk_get_project_preferences
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


def is_in_seer_config_reminder_list(organization: Organization) -> bool:
    return organization.slug in options.get("seer.organizations.force-config-reminder")


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


def is_autofix_enabled(organization: Organization) -> bool:
    """
    Check if autofix/RCA is enabled for any active project in the organization,
    ie, if any project has repositories configured in Seer preferences.
    """
    if features.has("organizations:seer-project-settings-read-from-sentry", organization):
        return SeerProjectRepository.objects.filter(
            project__organization_id=organization.id, project__status=ObjectStatus.ACTIVE
        ).exists()

    project_ids = list(
        Project.objects.filter(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
        ).values_list("id", flat=True)
    )

    if not project_ids:
        return False

    preferences = bulk_get_project_preferences(organization.id, project_ids)
    return any(pref and pref.get("repositories") for pref in preferences.values())


@cell_silo_endpoint
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
        try:
            autofix_enabled = is_autofix_enabled(organization)
        except SeerApiError as e:
            logger.exception(
                "seer.onboarding_check.autofix_check_error",
                extra={"organization_id": organization.id, "status_code": e.status},
            )
            return Response(
                {"detail": "Failed to check autofix status"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        has_scm_integration = has_supported_scm_integration(organization.id)
        code_review_enabled = is_code_review_enabled(organization.id)
        needs_config_reminder = is_in_seer_config_reminder_list(organization)
        is_seer_configured = has_scm_integration and (code_review_enabled or autofix_enabled)

        return Response(
            {
                "hasSupportedScmIntegration": has_scm_integration,
                "isCodeReviewEnabled": code_review_enabled,
                "isAutofixEnabled": autofix_enabled,
                "needsConfigReminder": needs_config_reminder,
                "isSeerConfigured": is_seer_configured,
            }
        )
