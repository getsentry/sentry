import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.preprod.pull_request.adapters import PullRequestDataAdapter
from sentry.preprod.pull_request.types import PullRequestWithFiles
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPullRequestDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, repo_name: str, pr_number: str
    ) -> Response:
        """
        Get files changed in a pull request and general information about the pull request.
        Returns normalized data that works across GitHub, GitLab, and Bitbucket.
        """
        if not features.has("organizations:pr-page", organization, actor=request.user):
            return Response({"error": "Feature not enabled"}, status=403)

        client = get_github_client(organization, repo_name)
        if not client:
            logger.warning(
                "No GitHub client found for organization",
                extra={"organization_id": organization.id},
            )
            error_data = PullRequestDataAdapter.create_error_response(
                error="integration_not_found",
                message="No GitHub integration found for this repository",
                details="Unable to find a GitHub integration for the specified repository",
            )
            return Response(error_data, status=404)

        try:
            # TODO(telkins): handle pagination
            pr_files = client.get_pullrequest_files(repo_name, pr_number)
            # TODO(telkins): push this into client
            pr_details = client.get(f"/repos/{repo_name}/pulls/{pr_number}")

            logger.info(
                "Fetched PR data from GitHub",
                extra={
                    "organization_id": organization.id,
                    "pr_number": pr_number,
                    "file_count": len(pr_files) if pr_files else 0,
                },
            )

            normalized_data: PullRequestWithFiles = PullRequestDataAdapter.from_github_pr_data(
                pr_details, pr_files or []
            )

            return Response(normalized_data, status=200)

        except ApiError:
            logger.exception(
                "GitHub API error when fetching PR data",
                extra={
                    "organization_id": organization.id,
                    "pr_number": pr_number,
                },
            )
            error_data = PullRequestDataAdapter.create_error_response(
                error="api_error",
                message="Failed to fetch pull request data from GitHub",
                details="A problem occurred when communicating with GitHub. Please try again later.",
            )
            return Response(error_data, status=502)
        except Exception:
            logger.exception(
                "Unexpected error fetching PR data",
                extra={
                    "organization_id": organization.id,
                    "pr_number": pr_number,
                },
            )
            error_data = PullRequestDataAdapter.create_error_response(
                error="internal_error",
                message="An unexpected error occurred while fetching pull request data",
            )
            return Response(error_data, status=500)


def get_github_client(organization: Organization, repo_name: str) -> GitHubApiClient | None:
    """Get the GitHub integration for this organization."""
    repository = Repository.objects.filter(
        organization_id=organization.id,
        name=repo_name,
        provider="integrations:github",
    ).first()
    if not repository:
        logger.info(
            "preprod.pullrequest_files.no_repository",
            extra={
                "organization_id": organization.id,
            },
        )
        return None

    if not repository.integration_id:
        logger.info(
            "preprod.pullrequest_files.no_integration_id",
            extra={
                "repository_id": repository.id,
            },
        )
        return None

    integration: RpcIntegration | None = integration_service.get_integration(
        integration_id=repository.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            "preprod.pullrequest_files.no_integration",
            extra={
                "repository_id": repository.id,
                "integration_id": repository.integration_id,
            },
        )
        return None

    installation: IntegrationInstallation = integration.get_installation(
        organization_id=organization.id
    )
    client = installation.get_client()

    if not isinstance(client, GitHubApiClient):
        logger.info(
            "preprod.pullrequest_files.not_github_client",
            extra={
                "repository_id": repository.id,
                "integration_id": repository.integration_id,
            },
        )
        return None

    return client
