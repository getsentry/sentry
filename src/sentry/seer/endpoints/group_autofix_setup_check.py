from __future__ import annotations

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.constants import CELL_API_DEPRECATION_DATE, DataCategory, ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    has_project_connected_repos,
)
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.types.ratelimit import RateLimit, RateLimitCategory


def get_autofix_integration_setup_problems(
    organization: Organization, project: Project
) -> str | None:
    """
    Runs through the checks to see if we can use the SCM integration for Autofix.
    Supports GitHub, GitHub Enterprise, and GitLab (when the seer-gitlab-support flag is enabled).

    If there are no issues, returns None.
    If there is an issue, returns the reason.
    """
    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization.id,
        providers=get_supported_scm_providers(organization),
    )

    # Iterate through all organization integrations to find one with an active integration
    for organization_integration in organization_integrations:
        integration = integration_service.get_integration(
            organization_integration_id=organization_integration.id, status=ObjectStatus.ACTIVE
        )
        if integration:
            installation = integration.get_installation(organization_id=organization.id)
            if installation:
                return None

    return "integration_missing"


@cell_silo_endpoint
class GroupAutofixSetupCheck(GroupAiEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
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

    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-autofix-setup",
        url_names=["sentry-api-0-group-autofix-setup"],
    )
    def get(self, request: Request, group: Group) -> Response:
        """
        Checks if we are able to run Autofix on the given group.
        """
        if not request.user.is_authenticated:
            return Response(status=400)

        org: Organization = request.organization

        integration_check = None
        # This check is to skip using the GitHub integration for Autofix in s4s.
        # As we only use the github integration to get the code mappings, we can skip this check if the repos are hardcoded.
        if not settings.SEER_AUTOFIX_FORCE_USE_REPOS:
            integration_check = get_autofix_integration_setup_problems(
                organization=org, project=group.project
            )

        has_autofix_quota: bool = quotas.backend.check_seer_quota(
            org_id=org.id, data_category=DataCategory.SEER_AUTOFIX
        )

        seer_repos_linked = False
        # Check if org has github integration and is on seat-based tier.
        if integration_check is None:
            try:
                seer_repos_linked = has_project_connected_repos(org, group.project)
            except Exception as e:
                sentry_sdk.capture_exception(e)

        autofix_enabled = False
        autofix_automation_tuning = group.project.get_option("sentry:autofix_automation_tuning")
        if (
            autofix_automation_tuning
            and autofix_automation_tuning != AutofixAutomationTuningSettings.OFF
        ):
            autofix_enabled = True

        return Response(
            {
                "integration": {
                    "ok": integration_check is None,
                    "reason": integration_check,
                },
                "setupAcknowledgement": {
                    "orgHasAcknowledged": True,
                    "userHasAcknowledged": True,
                },
                "billing": {
                    "hasAutofixQuota": has_autofix_quota,
                },
                "seerReposLinked": seer_repos_linked,
                "autofixEnabled": autofix_enabled,
            }
        )
