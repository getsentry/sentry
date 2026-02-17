from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodApiPrPageDetailsEvent
from sentry.preprod.integration_utils import get_github_client
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
        analytics.record(
            PreprodApiPrPageDetailsEvent(
                organization_id=organization.id,
                user_id=request.user.id,
                repo_name=repo_name,
                pr_number=pr_number,
            )
        )

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
            return Response(error_data.dict(), status=404)

        try:
            # TODO(telkins): handle pagination
            pr_files = client.get_pull_request_files(repo_name, pr_number)
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
                pr_details, pr_files or [], organization.id
            )

            return Response(normalized_data.dict(), status=200)

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
            return Response(error_data.dict(), status=502)
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
            return Response(error_data.dict(), status=500)
