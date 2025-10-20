import logging
from collections import defaultdict

import orjson
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
from sentry.seer.signed_seer_api import make_signed_seer_api_request

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

    def _fetch_seer_integrated_repos(self, organization_names: list[str]) -> dict[str, list[str]]:
        """
        Fetch repos from Seer for the given GitHub organizations that are integrated with Seer GH app.

        Returns a dict mapping GitHub org name to list of full repo names
        """
        path = "/v1/automation/codegen/prevent/integrated-repos"
        body = orjson.dumps(
            {
                "organization_names": organization_names,
                "provider": "github",
            }
        )

        response = make_signed_seer_api_request(
            connection_pool=PREVENT_AI_CONNECTION_POOL,
            path=path,
            body=body,
            timeout=SEER_PREVENT_AI_TIMEOUT,
        )

        if response.status >= 400:
            logger.warning(
                "Failed to fetch integrated repos from Seer",
                extra={"status": response.status, "organization_names": organization_names},
            )
            return {}

        return response.json().get("integrated_repos", {})

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

        # Fetch all repos integrated with Seer for the organization
        seer_integrated_repos = self._fetch_seer_integrated_repos(list(integration_map.keys()))

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

        # Determine what repos are installed in Sentry and Seer for each GitHub org
        org_repos = []
        for github_org_name, integration in integration_map.items():
            installed_repos = repos_by_integration.get(github_org_name, [])

            sentry_repos = {repo.name.split("/")[-1]: repo for repo in installed_repos}
            sentry_repo_names = set(sentry_repos.keys())
            seer_repo_names = set(seer_integrated_repos.get(github_org_name, []))

            repos = []
            for repo_name in sentry_repo_names & seer_repo_names:
                repos.append(
                    {
                        "id": sentry_repos[repo_name].external_id,
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
