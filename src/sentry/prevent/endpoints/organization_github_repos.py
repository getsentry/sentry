from typing import int
import logging
from collections import defaultdict

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url

logger = logging.getLogger(__name__)

PREVENT_AI_CONNECTION_POOL = connection_from_url(
    settings.SEER_PREVENT_AI_URL,
    maxsize=3,
)

SEER_PREVENT_AI_TIMEOUT = 30


@region_silo_endpoint
class OrganizationPreventGitHubReposEndpoint(OrganizationEndpoint):
    """
    Lists GitHub orgs linked to the Sentry org enabled for Prevent AI

    GET /organizations/{organization_id_or_slug}/prevent/github/repos/
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CODECOV

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List GitHub repositories linked to the Sentry organization for Prevent AI.

        Returns GitHub repos by GitHub orgs for the specified Sentry organization.
        """
        github_org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id,
            providers=[IntegrationProviderSlug.GITHUB.value],
            status=ObjectStatus.ACTIVE,
        )

        integration_ids = [
            org_integration.integration_id for org_integration in github_org_integrations
        ]
        if not integration_ids:
            return Response(data={"orgRepos": []})

        integration_map = {
            integration.name: integration
            for integration in integration_service.get_integrations(integration_ids=integration_ids)
        }

        # Fetch all repos integrated with Sentry for the organization
        integration_id_to_name = {
            integration.id: integration.name for integration in integration_map.values()
        }
        all_installed_repos = Repository.objects.filter(
            organization_id=organization.id,
            integration_id__in=[integration.id for integration in integration_map.values()],
            provider="integrations:github",
        ).exclude(status=ObjectStatus.HIDDEN)

        repos_by_integration = defaultdict(list)
        for repo in all_installed_repos:
            repos_by_integration[integration_id_to_name[repo.integration_id]].append(repo)

        org_repos = []
        for github_org_name, integration in integration_map.items():
            installed_repos = repos_by_integration.get(github_org_name, [])

            repos = []
            for repo in installed_repos:
                repo_name = repo.name.split("/")[-1]
                repos.append(
                    {
                        "id": repo.external_id,
                        "name": repo_name,
                        "fullName": f"{github_org_name}/{repo_name}",
                    }
                )

            if repos:
                account_id = integration.metadata.get("account_id")
                github_org_data = {
                    "githubOrganizationId": str(account_id) if account_id is not None else None,
                    "name": integration.name,
                    "repos": repos,
                }
                org_repos.append(github_org_data)

        return Response(data={"orgRepos": org_repos})
