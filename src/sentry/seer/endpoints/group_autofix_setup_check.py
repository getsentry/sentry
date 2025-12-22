from __future__ import annotations

import orjson
import requests
import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.constants import DataCategory, ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings
from sentry.seer.autofix.utils import (
    get_autofix_repos_from_project_code_mappings,
    has_project_connected_repos,
    is_seer_seat_based_tier_enabled,
)
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.seer_setup import get_seer_org_acknowledgement, get_seer_user_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.types.ratelimit import RateLimit, RateLimitCategory


def get_autofix_integration_setup_problems(
    organization: Organization, project: Project
) -> str | None:
    """
    Runs through the checks to see if we can use the GitHub integration for Autofix.

    If there are no issues, returns None.
    If there is an issue, returns the reason.
    """
    organization_integrations = integration_service.get_organization_integrations(
        organization_id=organization.id,
        providers=[
            IntegrationProviderSlug.GITHUB.value,
            IntegrationProviderSlug.GITHUB_ENTERPRISE.value,
        ],
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


def get_repos_and_access(project: Project, group_id: int) -> list[dict]:
    """
    Gets the repos that would be indexed for the given project from the code mappings, and checks if we have write access to them.

    Returns a list of repos with the "ok" key set to True if we have write access, False otherwise.
    """
    repos = get_autofix_repos_from_project_code_mappings(project)

    repos_and_access: list[dict] = []
    path = "/v1/automation/codebase/repo/check-access"
    for repo in repos:
        # We only support github and github enterprise for now.
        provider = repo.get("provider")
        if provider not in SEER_SUPPORTED_SCM_PROVIDERS:
            continue

        body = orjson.dumps(
            {
                "repo": repo,
                "group_id": group_id,
            }
        )

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )

        response.raise_for_status()

        repos_and_access.append({**repo, "ok": response.json().get("has_access", False)})

    return repos_and_access


@region_silo_endpoint
class GroupAutofixSetupCheck(GroupAiEndpoint):
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

        write_integration_check = None
        if request.query_params.get("check_write_access", False):
            repos = get_repos_and_access(group.project, group.id)
            write_access_ok = len(repos) > 0 and all(repo["ok"] for repo in repos)
            write_integration_check = {
                "ok": write_access_ok,
                "repos": repos,
            }

        user_acknowledgement = get_seer_user_acknowledgement(
            user_id=request.user.id, organization=org
        )
        org_acknowledgement = True
        if not user_acknowledgement:  # If the user has acknowledged, the org must have too.
            org_acknowledgement = get_seer_org_acknowledgement(org)

        has_autofix_quota: bool = quotas.backend.check_seer_quota(
            org_id=org.id, data_category=DataCategory.SEER_AUTOFIX
        )

        seer_seat_based_tier_enabled = is_seer_seat_based_tier_enabled(org)

        seer_repos_linked = False
        # Check if org has github integration and is on seat-based tier.
        if integration_check is None and seer_seat_based_tier_enabled:
            try:
                # Check if project has repos linked in Seer.
                # Skip cache to ensure latest data from Seer API.
                seer_repos_linked = has_project_connected_repos(
                    org.id, group.project.id, skip_cache=True
                )
            except Exception as e:
                # Default to False if we can't check if the project has repos linked in Seer.
                sentry_sdk.capture_exception(e)

        autofix_enabled = False
        autofix_automation_tuning = group.project.get_option("sentry:autofix_automation_tuning")
        if seer_seat_based_tier_enabled:
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
                "githubWriteIntegration": write_integration_check,
                "setupAcknowledgement": {
                    "orgHasAcknowledged": org_acknowledgement,
                    "userHasAcknowledged": user_acknowledgement,
                },
                "billing": {
                    "hasAutofixQuota": has_autofix_quota,
                },
                "seerReposLinked": seer_repos_linked,
                "autofixEnabled": autofix_enabled,
            }
        )
