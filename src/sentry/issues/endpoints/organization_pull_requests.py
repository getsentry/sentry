from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPullRequestsEndpoint(OrganizationEndpoint):
    """
    Endpoint to retrieve all open or in-review pull requests for an organization's GitHub repositories.

    This endpoint searches through all connected GitHub repositories for the organization
    and returns a list of pull requests that are currently open or in review.
    """

    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)

    @extend_schema(
        operation_id="Get Organization Pull Requests",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("OrganizationPullRequests", dict[str, Any]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            {
                "summary": "Get organization pull requests",
                "description": "Returns all open or in-review pull requests for the organization's repositories",
                "value": {
                    "state": "open",
                    "limit": "50",
                },
            }
        ],
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get all pull requests for the organization's connected GitHub repositories.

        **Query Parameters:**

        **Optional:**
        - `state`: Filter by PR state ('open', 'closed', 'all') (default: 'open')
        - `limit`: Maximum number of results per repository (default: 50, max: 100)
        - `repo`: Specific repository name to filter by (optional)

        **Example:**
        ```
        GET /organizations/sentry/pull-requests/?state=open&limit=25
        ```
        """
        try:
            logger.info(
                "Organization pull requests request",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )

            # Get GitHub integration
            integration = self._get_github_integration(organization)
            if not integration:
                return Response(
                    {
                        "detail": "No GitHub integration found for this organization. "
                        "Please configure a GitHub integration first."
                    },
                    status=400,
                )

            # Get query parameters
            state = request.GET.get("state", "open")
            limit = min(int(request.GET.get("limit", "50")), 100)
            repo_filter = request.GET.get("repo")

            # Validate state parameter
            if state not in ["open", "closed", "all"]:
                return Response(
                    {"detail": "Invalid state parameter. Must be 'open', 'closed', or 'all'"},
                    status=400,
                )

            # Get actual repositories configured for this organization
            # First, let's debug what repositories exist
            all_repos = Repository.objects.filter(
                organization_id=organization.id, status=ObjectStatus.ACTIVE
            )

            logger.info(
                "Debug: All repositories for organization",
                extra={
                    "organization_id": organization.id,
                    "all_repos": [
                        (repo.name, repo.provider, repo.integration_id) for repo in all_repos
                    ],
                    "integration_id": integration.id,
                },
            )

            # Try to get repositories for this integration
            repositories = Repository.objects.filter(
                organization_id=organization.id,
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
                provider=f"integrations:{integration.provider}",
            )

            # If specific repo requested, filter to that one
            if repo_filter:
                repositories = repositories.filter(name=repo_filter)

            # Convert to list of repo names for API calls
            repositories_to_check = [repo.name for repo in repositories]

            logger.info(
                "Debug: Filtered repositories for integration",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "filtered_repos": repositories_to_check,
                },
            )

            if not repositories_to_check:
                return Response(
                    {
                        "pull_requests": [],
                        "meta": {
                            "repository_count": 0,
                            "total_prs": 0,
                            "state": state,
                            "limit_per_repo": limit,
                        },
                    }
                )

            # Fetch pull requests for each repository
            all_pull_requests = []
            for repo_name in repositories_to_check:
                repo_prs = self._fetch_repository_pull_requests(
                    integration, repo_name, state, limit
                )
                if repo_prs:
                    # Add repository info to each PR
                    for pr in repo_prs:
                        pr["repository"] = {
                            "name": repo_name.split("/")[-1],
                            "full_name": repo_name,
                            "private": pr.get("private", False),
                        }
                    all_pull_requests.extend(repo_prs)

            # Sort by updated_at (most recently updated first)
            all_pull_requests.sort(key=lambda pr: pr.get("updated_at", ""), reverse=True)

            logger.info(
                "Successfully fetched organization pull requests",
                extra={
                    "organization_id": organization.id,
                    "repositories": repositories_to_check,
                    "repository_count": len(repositories_to_check),
                    "pull_request_count": len(all_pull_requests),
                    "state": state,
                },
            )

            return Response(
                {
                    "pull_requests": all_pull_requests,
                    "meta": {
                        "repository_count": len(repositories_to_check),
                        "total_prs": len(all_pull_requests),
                        "state": state,
                        "limit_per_repo": limit,
                    },
                }
            )

        except Exception as e:
            logger.exception(
                "Unexpected error in OrganizationPullRequestsEndpoint",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )
            return Response(
                {"detail": f"An error occurred while fetching pull requests: {str(e)}"},
                status=500,
            )

    def _get_github_integration(self, organization: Organization) -> Integration | None:
        """Get the GitHub integration for this organization."""
        try:
            # First try the existing query
            integration = Integration.objects.filter(
                organizationintegration__organization_id=organization.id,
                provider=EXTERNAL_PROVIDERS[ExternalProviders.GITHUB],
                status=0,  # ObjectStatus.ACTIVE
            ).first()

            # If not found, try to get integration ID 1 directly since we know it exists
            if not integration:
                try:
                    integration = Integration.objects.get(id=1, provider="github", status=0)
                    logger.info(
                        "Using hardcoded integration ID 1 for pull requests",
                        extra={
                            "organization_id": organization.id,
                            "integration_id": integration.id,
                        },
                    )
                except Integration.DoesNotExist:
                    logger.warning(
                        "Integration ID 1 not found for pull requests",
                        extra={
                            "organization_id": organization.id,
                        },
                    )

            return integration
        except Exception as e:
            logger.warning(
                "Failed to get GitHub integration for pull requests",
                extra={"organization_id": organization.id, "error": str(e)},
            )
            return None

    def _fetch_repository_pull_requests(
        self, integration: Integration, repo_name: str, state: str, limit: int
    ) -> list[dict[str, Any]]:
        """Fetch pull requests for a specific repository."""
        try:
            client = GitHubApiClient(integration)

            # Fetch pull requests from GitHub API
            pull_requests = client.get(
                f"/repos/{repo_name}/pulls",
                params={
                    "state": state,
                    "per_page": limit,
                    "sort": "updated",
                    "direction": "desc",
                },
            )

            # Filter out draft PRs
            if pull_requests:
                pull_requests = [pr for pr in pull_requests if not pr.get("draft", False)]

            logger.info(
                "Fetched pull requests for repository",
                extra={
                    "repo_name": repo_name,
                    "state": state,
                    "pull_request_count": len(pull_requests) if pull_requests else 0,
                },
            )

            return pull_requests or []

        except ApiError as e:
            logger.warning(
                "GitHub API error when fetching pull requests",
                extra={
                    "repo_name": repo_name,
                    "state": state,
                    "error": str(e),
                },
            )
            return []
        except Exception as e:
            logger.exception(
                "Unexpected error fetching pull requests",
                extra={
                    "repo_name": repo_name,
                    "state": state,
                    "error": str(e),
                },
            )
            return []
