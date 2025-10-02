import logging

import orjson
import requests
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
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)


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

        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
        )
        response.raise_for_status()

        return response.json().get("integrated_repos", {})

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List GitHub repositories linked to the Sentry organization for Prevent AI.

        Returns GitHub repos by GitHub orgs for the specified Sentry organization.
        """
        logger.info(
            "PreventGitHubRepos endpoint called",
            extra={
                "organization_id": organization.id,
                "organization_slug": organization.slug,
                "organization_name": organization.name,
                "user_id": request.user.id if request.user.is_authenticated else None,
            },
        )

        github_org_integrations = integration_service.get_organization_integrations(
            organization_id=organization.id,
            providers=[IntegrationProviderSlug.GITHUB.value],
            status=ObjectStatus.ACTIVE,
        )

        integration_map = {}
        for org_integration in github_org_integrations:
            integration = integration_service.get_integration(
                integration_id=org_integration.integration_id
            )
            if integration:
                integration_map[integration.name] = integration

        # Call Seer API to get integrated repos with Seer GH app
        seer_integrated_repos = {}
        if integration_map:
            try:
                seer_integrated_repos = self._fetch_seer_integrated_repos(
                    list(integration_map.keys())
                )
            except Exception as e:
                logger.warning(
                    "Failed to fetch Seer integrated repos",
                    extra={
                        "organization_id": organization.id,
                        "error": str(e),
                    },
                )

        # Determine what repos are installed in Sentry and Seer for each GitHub org
        org_repos = []
        for github_org_name, integration in integration_map.items():
            installed_repos = Repository.objects.filter(
                organization_id=organization.id,
                integration_id=integration.id,
                provider="integrations:github",
            ).exclude(status=ObjectStatus.HIDDEN)

            sentry_repo_names = {repo.name.split("/")[-1] for repo in installed_repos}
            seer_repo_names = set(seer_integrated_repos.get(github_org_name, []))

            repos = []
            for repo_name in sentry_repo_names | seer_repo_names:
                repos.append(
                    {
                        "name": repo_name,
                        "fullName": f"{github_org_name}/{repo_name}",
                        "hasGhAppSentryIo": repo_name in sentry_repo_names,
                        "hasGhAppSeerBySentry": repo_name in seer_repo_names,
                    }
                )

            github_org_data = {
                "githubOrganizationId": integration.metadata.get("account_id"),
                "name": integration.name,
                "repos": repos,
            }
            org_repos.append(github_org_data)

        return Response(data={"orgRepos": org_repos})
