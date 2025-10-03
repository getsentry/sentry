import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.models.organization import Organization
from sentry.preprod.integration_utils import get_github_client
from sentry.preprod.pull_request.comment_adapters import PullRequestCommentsAdapter
from sentry.preprod.pull_request.comment_types import PullRequestComments
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationPrCommentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, organization: Organization, repo_name: str, pr_number: str
    ) -> Response:
        """
        Get GitHub comments for a Pull Request.

        Returns both general PR comments and file-specific review comments.

        **Path Parameters:**
        - `repo_name`: Repository name (e.g., 'owner/repo')
        - `pr_number`: Pull request number

        **Example:**
        ```
        GET /projects/sentry/pr-comments/getsentry/sentry/12345/
        ```
        """
        if not features.has("organizations:pr-page", organization, actor=request.user):
            return Response({"error": "Feature not enabled"}, status=403)

        client = get_github_client(organization, repo_name)
        if not client:
            logger.warning(
                "No GitHub client found for organization",
                extra={"organization_id": organization.id},
            )
            error_data = PullRequestCommentsAdapter.create_error_response(
                error="integration_not_found",
                message="No GitHub integration found for this repository",
                details="Unable to find a GitHub integration for the specified repository",
            )
            return Response(error_data.dict(), status=404)

        try:
            general_comments_raw = self._fetch_pr_general_comments(client, repo_name, pr_number)
            review_comments_raw = self._fetch_pr_review_comments(client, repo_name, pr_number)

            comments_data: PullRequestComments = PullRequestCommentsAdapter.from_github_comments(
                general_comments_raw, review_comments_raw
            )

            logger.info(
                "Fetched PR comments from GitHub",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "general_comments_count": len(comments_data.general_comments),
                    "review_comments_count": sum(
                        len(comments) for comments in comments_data.file_comments.values()
                    ),
                    "files_with_comments": len(comments_data.file_comments),
                },
            )

            return Response(comments_data.dict(), status=200)

        except ApiError:
            logger.exception(
                "GitHub API error when fetching PR comments",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                },
            )
            error_data = PullRequestCommentsAdapter.create_error_response(
                error="api_error",
                message="Failed to fetch pull request comments from GitHub",
                details="A problem occurred when communicating with GitHub. Please try again later.",
            )
            return Response(error_data.dict(), status=502)
        except Exception:
            logger.exception(
                "Unexpected error fetching PR comments",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                },
            )
            error_data = PullRequestCommentsAdapter.create_error_response(
                error="internal_error",
                message="An unexpected error occurred while fetching pull request comments",
            )
            return Response(error_data.dict(), status=500)

    def _fetch_pr_general_comments(
        self, client: GitHubApiClient, repo_name: str, pr_number: str
    ) -> list[dict]:
        """
        Fetch general PR comments from GitHub.

        These are the comments posted in the main PR conversation thread.
        """
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_ISSUE_COMMENTS,
            provider_key=self.provider_key,
            organization_id=self.organization_id,
            integration_id=self.integration_id,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                }
            )
            comments = client.get_issue_comments(repo_name, pr_number)
            return comments or []

    def _fetch_pr_review_comments(
        self, client: GitHubApiClient, repo_name: str, pr_number: str
    ) -> list[dict]:
        """
        Fetch PR review comments from GitHub.

        These are the comments posted on specific lines in file diffs during code review.
        """
        with SCMIntegrationInteractionEvent(
            interaction_type=SCMIntegrationInteractionType.GET_PR_COMMENTS,
            provider_key=self.provider_key,
            organization_id=self.organization_id,
            integration_id=self.integration_id,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                }
            )
            comments = client.get_pullrequest_comments(repo_name, pr_number)
            return comments or []
