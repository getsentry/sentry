from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repositorysettings import RepositorySettings
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class OrganizationSeerOnboardingCheckResponse(TypedDict):
    hasSupportedScmIntegration: bool
    isCodeReviewEnabled: bool
    isAutofixEnabled: bool
    isSeerConfigured: bool


def has_supported_scm_integration(organization: Organization) -> bool:
    """Check if the organization has an active and supported SCM, e.g. GitHub or GitHub Enterprise or GitLab integration."""

    providers = [
        IntegrationProviderSlug.GITHUB.value,
        IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
    ]

    if features.has("organizations:seer-gitlab-support", organization):
        providers.append(IntegrationProviderSlug.GITLAB.value)

    if features.has("organizations:seer-cursor-origin-support", organization):
        providers.append(IntegrationProviderSlug.CURSOR_ORIGIN.value)

    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization.id,
        providers=providers,
        status=ObjectStatus.ACTIVE,
    )

    return len(organization_integrations) > 0


def is_code_review_enabled(organization: Organization) -> bool:
    """Check if code review is enabled for any active repository in the organization."""
    return RepositorySettings.objects.filter(
        repository__organization_id=organization.id,
        repository__status=ObjectStatus.ACTIVE,
        enabled_code_review=True,
    ).exists()


def is_autofix_enabled(organization: Organization) -> bool:
    """
    Check if autofix/RCA is enabled for any active project in the organization,
    ie, if any project has repositories configured in Seer preferences.
    """
    return SeerProjectRepository.objects.filter(
        project_repository__project__organization_id=organization.id,
        project_repository__project__status=ObjectStatus.ACTIVE,
        project_repository__repository__status=ObjectStatus.ACTIVE,
    ).exists()


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class OrganizationSeerOnboardingCheck(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
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

    @extend_schema(
        operation_id="getOrganizationSeerOnboardingCheck",
        summary="Check Seer Onboarding for an Organization",
        description=(
            "Check whether the organization has a supported source control integration, code review "
            "or Autofix enabled, and Seer configured."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationSeerOnboardingCheckResponse", OrganizationSeerOnboardingCheckResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationSeerOnboardingCheckResponse]:
        """Check if the organization has completed Seer onboarding/configuration."""
        autofix_enabled = is_autofix_enabled(organization)
        has_scm_integration = has_supported_scm_integration(organization)
        code_review_enabled = is_code_review_enabled(organization)
        is_seer_configured = has_scm_integration and (code_review_enabled or autofix_enabled)

        return Response(
            {
                "hasSupportedScmIntegration": has_scm_integration,
                "isCodeReviewEnabled": code_review_enabled,
                "isAutofixEnabled": autofix_enabled,
                "isSeerConfigured": is_seer_configured,
            }
        )
