from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import search
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializerSnuba
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidSearchQuery
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.models.integration import Integration
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger(__name__)


def build_file_query(filename: str) -> str:
    """
    Build a search query to find issues affecting a specific file.

    Args:
        filename: Single filename to search for

    Returns:
        Search query string for the file
    """
    if not filename:
        return ""

    # Remove leading slashes and normalize path
    clean_filename = filename
    clean_filename = clean_filename.removeprefix("webpack-internal:///./")
    clean_filename = clean_filename.removeprefix("web/")

    # Extract just the basename for matching
    basename = clean_filename.split("/")[-1]
    if not basename:
        return ""

    query = f'stack.filename:"*{basename}*"'

    logger.info(
        "[telkins] Generated file search query",
        extra={
            "original_file": filename,
            "clean_file": clean_filename,
            "basename": basename,
            "query": query,
        },
    )

    return query


@region_silo_endpoint
class OrganizationPrIssuesEndpoint(OrganizationEndpoint):
    """
    Endpoint to retrieve issues related to files changed in a Pull Request.

    This endpoint searches for issues that have stack traces containing
    any of the files changed in the specified PR.
    """

    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)

    @extend_schema(
        operation_id="Get Pull Request Issues",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("OrganizationPrIssues", dict[str, Any]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            {
                "summary": "Get issues for GitHub PR",
                "description": "Returns issues related to files changed in a GitHub PR",
                "value": {
                    "repo": "getsentry/sentry",
                    "pr": "12345",
                    "statsPeriod": "14d",
                    "query": "is:unresolved",
                },
            }
        ],
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get issues related to files changed in a Pull Request.

        **Query Parameters:**

        **Required:**
        - `repo`: Repository name (e.g., 'getsentry/sentry') (required)
        - `pr`: Pull request number (required)

        **Optional:**
        - `statsPeriod`: Time period for results (default: 14d)
        - `query`: Additional search query to filter issue results (optional)
        - `limit`: Maximum number of results (default: 25, max: 100)

        **Example:**
        ```
        GET /organizations/sentry/pr-issues/?repo=getsentry/sentry&pr=12345&statsPeriod=14d&query=is:unresolved
        ```
        """
        try:
            # Get required parameters
            repo_name = request.GET.get("repo")
            pr_number = request.GET.get("pr")

            # Validate required parameters
            if not repo_name or not pr_number:
                return Response(
                    {"detail": "Both 'repo' and 'pr' parameters are required"},
                    status=400,
                )

            logger.info(
                "[telkins] PR issues request",
                extra={
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "organization_id": organization.id,
                },
            )

            # Fetch files from GitHub PR
            pr_files = self._fetch_pr_files(organization, repo_name, pr_number)

            if not pr_files:
                logger.warning(
                    "[telkins] No PR files found for issues search",
                    extra={
                        "repo_name": repo_name,
                        "pr_number": pr_number,
                        "organization_id": organization.id,
                    },
                )
                return Response(
                    {
                        "detail": f"Could not fetch files for PR #{pr_number} in {repo_name}. "
                        "Make sure the GitHub integration is configured and the repository exists."
                    },
                    status=400,
                )

            # Extract filenames from GitHub PR files
            filenames = [file_data["filename"] for file_data in pr_files]

            # Get projects and environments
            try:
                projects = self.get_projects(request, organization)
                environments = self.get_environments(request, organization)
            except Exception:
                return Response({"detail": "Invalid project or environment"}, status=400)

            # Get issues data for the PR files
            issues_data = self._get_issues_data(
                request, organization, projects, environments, filenames
            )

            return Response(issues_data)

        except Exception as e:
            logger.exception(
                "[telkins] Unexpected error in OrganizationPrIssuesEndpoint",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )
            return Response(
                {"detail": f"An error occurred while processing PR issues data: {str(e)}"},
                status=500,
            )

    def get_projects(self, request: Request, organization: Organization) -> list[Project]:
        """Get projects from request, defaulting to all accessible projects."""
        project_ids = request.GET.getlist("project")
        if project_ids:
            return list(
                Project.objects.filter(
                    id__in=project_ids,
                    organization=organization,
                    status=0,  # ProjectStatus.ACTIVE
                )
            )

        # Default to all projects user has access to
        return list(organization.project_set.filter(status=0))

    def get_environments(self, request: Request, organization: Organization) -> list[Environment]:
        """Get environments from request."""
        environment_names = request.GET.getlist("environment")
        if environment_names:
            return list(
                Environment.objects.filter(
                    name__in=environment_names,
                    organization_id=organization.id,
                )
            )
        return []

    def _fetch_pr_files(
        self, organization: Organization, repo_name: str, pr_number: str
    ) -> list[dict[str, Any]]:
        """
        Fetch the list of files changed in a PR from GitHub.
        """
        integration = self._get_github_integration(organization)
        if not integration:
            logger.warning(
                "[telkins] No GitHub integration found for PR issues",
                extra={"organization_id": organization.id},
            )
            return []

        try:
            # Create GitHub API client
            client = GitHubApiClient(integration)

            # Fetch PR files from GitHub
            pr_files = client.get_pullrequest_files(repo_name, pr_number)

            logger.info(
                "[telkins] Fetched PR files for issues search",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "file_count": len(pr_files) if pr_files else 0,
                },
            )

            return pr_files or []

        except Exception as e:
            logger.exception(
                "[telkins] Error fetching PR files for issues search",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error_type": type(e).__name__,
                },
            )
            return []

    def _get_github_integration(self, organization: Organization) -> Integration | None:
        """Get the GitHub integration for this organization."""
        try:
            # First try the existing query
            integration = Integration.objects.filter(
                organizationintegration__organization_id=organization.id,
                provider="github",
                status=0,  # ObjectStatus.ACTIVE
            ).first()

            # If not found, try to get integration ID 1 directly since we know it exists
            if not integration:
                try:
                    integration = Integration.objects.get(id=1, provider="github", status=0)
                    logger.info(
                        "[telkins] Using hardcoded integration ID 1 for issues search",
                        extra={
                            "organization_id": organization.id,
                            "integration_id": integration.id,
                        },
                    )
                except Integration.DoesNotExist:
                    logger.warning(
                        "[telkins] Integration ID 1 not found for issues search",
                        extra={
                            "organization_id": organization.id,
                        },
                    )

            return integration
        except Exception as e:
            logger.warning(
                "[telkins] Failed to get GitHub integration for issues search",
                extra={"organization_id": organization.id, "error": str(e)},
            )
            return None

    def _get_issues_data(
        self,
        request: Request,
        organization: Organization,
        projects: list[Project],
        environments: list[Environment],
        filenames: list[str],
    ) -> dict[str, Any]:
        """Get issues data for the specified files by making separate searches for each file."""
        try:
            logger.info(
                "[telkins] Starting separate searches for each file",
                extra={
                    "organization_id": organization.id,
                    "pr_files": filenames,
                    "file_count": len(filenames),
                },
            )

            if not filenames:
                return {"issues": [], "meta": {"query": "", "total_count": 0}, "pagination": {}}

            all_issues = []
            all_queries = []
            total_searches = 0

            # Make separate search for each file
            for filename in filenames[:3]:  # Limit to first 3 files to avoid too many requests
                file_query = build_file_query(filename)
                if not file_query:
                    continue

                # Extract basename for logging
                clean_filename = filename.removeprefix("webpack-internal:///./").removeprefix(
                    "web/"
                )
                basename = clean_filename.split("/")[-1]

                all_queries.append(file_query)
                total_searches += 1

                logger.info(
                    "[telkins] Searching for file",
                    extra={
                        "organization_id": organization.id,
                        "pr_filename": filename,
                        "basename": basename,
                        "file_query": file_query,
                    },
                )

                # Create modified request for this file
                modified_get = request.GET.copy()
                modified_get["query"] = file_query

                original_get = request.GET
                request.GET = modified_get

                try:
                    # Build query parameters for this specific file
                    query_kwargs = build_query_params_from_request(
                        request, organization, projects, environments
                    )

                    # Execute search for this file
                    result = search.backend.query(**query_kwargs)

                    logger.info(
                        "[telkins] File search completed",
                        extra={
                            "organization_id": organization.id,
                            "basename": basename,
                            "result_count": len(result.results) if result.results else 0,
                            "total_hits": getattr(result, "hits", None),
                        },
                    )

                    # Add results to our combined list (avoiding duplicates by ID)
                    existing_ids = {issue.id for issue in all_issues}
                    new_issues = [
                        issue for issue in (result.results or []) if issue.id not in existing_ids
                    ]
                    all_issues.extend(new_issues)

                finally:
                    # Restore original GET parameters
                    request.GET = original_get

            logger.info(
                "[telkins] All file searches completed",
                extra={
                    "organization_id": organization.id,
                    "total_searches": total_searches,
                    "combined_issues_count": len(all_issues),
                    "all_queries": all_queries,
                },
            )

            # Serialize the combined results
            # Use a simpler serializer to avoid rate limiting issues
            try:
                serializer = StreamGroupSerializerSnuba(
                    environment_ids=[env.id for env in environments],
                    stats_period=request.GET.get("statsPeriod", "14d"),
                )
                serialized_data = serialize(all_issues, request.user, serializer)

                logger.info(
                    "[telkins] Serialization completed successfully",
                    extra={
                        "organization_id": organization.id,
                        "serialized_count": len(serialized_data),
                    },
                )
            except Exception as serialization_error:
                logger.warning(
                    "[telkins] Serialization failed, using basic serialization",
                    extra={
                        "organization_id": organization.id,
                        "error": str(serialization_error),
                        "issues_count": len(all_issues),
                    },
                )
                # Fallback to basic serialization without stats
                from sentry.api.serializers.models.group import GroupSerializer

                basic_serializer = GroupSerializer()
                serialized_data = serialize(all_issues, request.user, basic_serializer)

            return {
                "issues": serialized_data,
                "meta": {
                    "query": " | ".join(all_queries),  # Show all queries that were run
                    "total_count": len(all_issues),
                    "searches_performed": total_searches,
                },
                "pagination": {
                    "next": None,  # We don't support pagination across multiple searches for now
                    "prev": None,
                },
            }

        except Exception as e:
            logger.exception("[telkins] Error getting issues data for PR")
            return {"issues": [], "error": f"Failed to fetch issues: {str(e)}"}


@region_silo_endpoint
class OrganizationPrDataEndpoint(OrganizationEndpoint):
    """
    Endpoint to retrieve various data related to files changed in a Pull Request.

    This endpoint provides comprehensive information about files in a PR including:
    - Issues/errors affecting those files
    - Performance metrics for those files
    - Recent releases affecting those files
    - Code coverage information
    - And other relevant data for PR review
    """

    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)

    @extend_schema(
        operation_id="Get Pull Request Data",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("OrganizationPrData", dict[str, Any]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            {
                "summary": "Get PR data for GitHub PR",
                "description": "Returns comprehensive data for files changed in a GitHub PR",
                "value": {
                    "repo": "getsentry/sentry",
                    "pr": "12345",
                    "statsPeriod": "14d",
                    "include": "issues,performance,releases",
                },
            }
        ],
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get comprehensive data for files changed in a Pull Request.

        Returns various types of data related to the files in a PR:
        - Issues/errors affecting those files
        - Performance metrics and trends
        - Recent releases and deployments
        - Code coverage information
        - File-specific analytics

        **Query Parameters:**

        **Required:**
        - `repo`: Repository name (e.g., 'getsentry/sentry') (required)
        - `pr`: Pull request number (required)

        **Optional:**
        - `include`: Comma-separated list of data types to include (default: issues)
          Available types: issues, performance, releases, coverage, analytics
        - `statsPeriod`: Time period for results (default: 14d)
        - `query`: Additional search query to filter issue results (optional)
        - `limit`: Maximum number of results per data type (default: 25, max: 100)

        **Example:**
        ```
        GET /organizations/sentry/pr-data/?repo=getsentry/sentry&pr=12345&include=issues,performance&statsPeriod=14d
        ```
        """
        try:
            logger.info(
                "[telkins] Starting PR data request",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )

            # Get required parameters
            repo_name = request.GET.get("repo")
            pr_number = request.GET.get("pr")

            # Validate required parameters
            if not repo_name or not pr_number:
                return Response(
                    {"detail": "Both 'repo' and 'pr' parameters are required"},
                    status=400,
                )

            logger.info(
                "[telkins] PR request params",
                extra={
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "organization_id": organization.id,
                },
            )

            # Fetch files and details from GitHub PR
            pr_files = self._fetch_pr_files(organization, repo_name, pr_number)
            pr_details = self._fetch_pr_details(organization, repo_name, pr_number)

            logger.info(
                "[telkins] GitHub PR files result",
                extra={
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "organization_id": organization.id,
                    "file_count": len(pr_files) if pr_files else 0,
                    "has_files": bool(pr_files),
                    "has_pr_details": bool(pr_details),
                },
            )

            if not pr_files:
                logger.warning(
                    "[telkins] No PR files found",
                    extra={
                        "repo_name": repo_name,
                        "pr_number": pr_number,
                        "organization_id": organization.id,
                    },
                )
                return Response(
                    {
                        "detail": f"Could not fetch files for PR #{pr_number} in {repo_name}. "
                        "Make sure the GitHub integration is configured and the repository exists."
                    },
                    status=400,
                )

            # Extract filenames from GitHub PR files
            filenames = [file_data["filename"] for file_data in pr_files]

            # Get data types to include (issues are now handled by separate endpoint)
            include_param = request.GET.get("include", "performance")
            include_types = [t.strip() for t in include_param.split(",") if t.strip()]

            # Validate include types (issues removed - now handled by separate endpoint)
            valid_types = {"performance", "releases", "coverage", "analytics"}
            invalid_types = set(include_types) - valid_types
            if invalid_types:
                return Response(
                    {
                        "detail": f"Invalid include types: {', '.join(invalid_types)}. Valid types: {', '.join(valid_types)}"
                    },
                    status=400,
                )

            # Build response data (no longer includes issues data)
            response_data = {
                "files": filenames,
                "statsPeriod": request.GET.get("statsPeriod", "14d"),
                "data": {},
                "pr_files": pr_files,
                "repo": repo_name,
                "pr_number": pr_number,
            }

            # Include PR details if we fetched them
            if pr_details:
                response_data["pr_details"] = pr_details

            # Get performance data
            if "performance" in include_types:
                performance_data = self._get_performance_data(request, organization, filenames)
                response_data["data"]["performance"] = performance_data

            # Get releases data
            if "releases" in include_types:
                releases_data = self._get_releases_data(request, organization, filenames)
                response_data["data"]["releases"] = releases_data

            # Get coverage data (placeholder for now)
            if "coverage" in include_types:
                response_data["data"]["coverage"] = {
                    "message": "Coverage data integration coming soon",
                    "files": filenames,
                }

            # Get analytics data (placeholder for now)
            if "analytics" in include_types:
                response_data["data"]["analytics"] = {
                    "message": "Analytics data integration coming soon",
                    "files": filenames,
                }

            return Response(response_data)

        except InvalidSearchQuery as e:
            logger.exception(
                "[telkins] Invalid search query",
                extra={
                    "organization_id": organization.id,
                    "error": str(e),
                },
            )
            return Response({"detail": f"Invalid search query: {e}"}, status=400)
        except Exception as e:
            logger.exception(
                "[telkins] Unexpected error in OrganizationPrDataEndpoint",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )
            return Response(
                {"detail": f"An error occurred while processing PR data: {str(e)}"}, status=500
            )

    def get_projects(self, request: Request, organization: Organization) -> list[Project]:
        """Get projects from request, defaulting to all accessible projects."""
        project_ids = request.GET.getlist("project")
        if project_ids:
            return list(
                Project.objects.filter(
                    id__in=project_ids,
                    organization=organization,
                    status=0,  # ProjectStatus.ACTIVE
                )
            )

        # Default to all projects user has access to
        return list(organization.project_set.filter(status=0))

    def get_environments(self, request: Request, organization: Organization) -> list[Environment]:
        """Get environments from request."""
        environment_names = request.GET.getlist("environment")
        if environment_names:
            return list(
                Environment.objects.filter(
                    name__in=environment_names,
                    organization_id=organization.id,
                )
            )
        return []

    def _get_performance_data(
        self,
        request: Request,
        organization: Organization,
        filenames: list[str],
    ) -> dict[str, Any]:
        """Get performance data for the specified files."""
        # Placeholder implementation - would integrate with performance monitoring
        return {
            "message": "Performance data integration coming soon",
            "files": filenames,
            "planned_metrics": ["transaction_duration", "throughput", "error_rate", "apdex_score"],
        }

    def _get_releases_data(
        self,
        request: Request,
        organization: Organization,
        filenames: list[str],
    ) -> dict[str, Any]:
        """Get releases data for the specified files."""
        # Placeholder implementation - would integrate with release tracking
        return {
            "message": "Release data integration coming soon",
            "files": filenames,
            "planned_data": [
                "recent_releases",
                "deployment_frequency",
                "release_health",
                "rollback_incidents",
            ],
        }

    def _get_github_integration(self, organization: Organization) -> Integration | None:
        """Get the GitHub integration for this organization."""
        try:
            logger.info(
                "[telkins] Looking for GitHub integration",
                extra={
                    "organization_id": organization.id,
                },
            )

            # First try the existing query
            integration = Integration.objects.filter(
                organizationintegration__organization_id=organization.id,
                provider="github",
                status=0,  # ObjectStatus.ACTIVE
            ).first()

            # If not found, let's check what integrations exist
            if not integration:
                all_integrations = Integration.objects.filter(provider="github", status=0)
                logger.info(
                    "[telkins] All GitHub integrations",
                    extra={
                        "organization_id": organization.id,
                        "all_github_integrations": [(i.id, i.name) for i in all_integrations],
                    },
                )

                # Try to get integration ID 1 directly since we know it exists
                try:
                    integration = Integration.objects.get(id=1, provider="github", status=0)
                    logger.info(
                        "[telkins] Using hardcoded integration ID 1",
                        extra={
                            "organization_id": organization.id,
                            "integration_id": integration.id,
                        },
                    )
                except Integration.DoesNotExist:
                    logger.warning(
                        "[telkins] Integration ID 1 not found",
                        extra={
                            "organization_id": organization.id,
                        },
                    )

            logger.info(
                "[telkins] GitHub integration lookup result",
                extra={
                    "organization_id": organization.id,
                    "integration_found": bool(integration),
                    "integration_id": integration.id if integration else None,
                    "integration_name": integration.name if integration else None,
                },
            )

            return integration
        except Exception as e:
            logger.warning(
                "[telkins] Failed to get GitHub integration",
                extra={"organization_id": organization.id, "error": str(e)},
            )
            return None

    def _fetch_pr_files(
        self, organization: Organization, repo_name: str, pr_number: str
    ) -> list[dict[str, Any]]:
        """
        Fetch the list of files changed in a PR from GitHub.

        Returns:
            List of file objects from GitHub API, each containing:
            - filename: the file path
            - status: added, modified, deleted, renamed
            - additions: number of lines added
            - deletions: number of lines deleted
            - changes: total number of changes
            - patch: the diff content (if available)
        """
        integration = self._get_github_integration(organization)
        if not integration:
            logger.warning(
                "[telkins] No GitHub integration found for organization",
                extra={"organization_id": organization.id},
            )
            return []

        try:
            logger.info(
                "[telkins] Creating GitHub API client",
                extra={
                    "organization_id": organization.id,
                    "integration_id": integration.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                },
            )

            # Create GitHub API client
            client = GitHubApiClient(integration)

            logger.info(
                "[telkins] Calling GitHub API for PR files",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                },
            )

            # Fetch PR files from GitHub
            pr_files = client.get_pullrequest_files(repo_name, pr_number)

            logger.info(
                "[telkins] Fetched PR files from GitHub",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "file_count": len(pr_files) if pr_files else 0,
                    "pr_files_sample": (
                        pr_files[:2] if pr_files else None
                    ),  # Log first 2 files for debugging
                },
            )

            return pr_files or []

        except ApiError as e:
            logger.warning(
                "[telkins] GitHub API error when fetching PR files",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            return []
        except Exception as e:
            logger.exception(
                "[telkins] Unexpected error fetching PR files",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error_type": type(e).__name__,
                },
            )
            return []

    def _fetch_pr_details(
        self, organization: Organization, repo_name: str, pr_number: str
    ) -> dict[str, Any] | None:
        """
        Fetch PR details (title, description, author) from GitHub.

        Returns:
            Dictionary containing PR details:
            - title: PR title
            - body: PR description/body
            - user: Author information (login, avatar_url, etc.)
            - state: PR state (open, closed, merged)
            - created_at: Creation timestamp
            - updated_at: Last updated timestamp
            - html_url: GitHub URL for the PR
        """
        integration = self._get_github_integration(organization)
        if not integration:
            logger.warning(
                "[telkins] No GitHub integration found for PR details",
                extra={"organization_id": organization.id},
            )
            return None

        try:
            logger.info(
                "[telkins] Calling GitHub API for PR details",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                },
            )

            # Create GitHub API client
            client = GitHubApiClient(integration)

            # Fetch PR details from GitHub
            # Use the standard GitHub API endpoint for getting PR details
            pr_details = client.get(f"/repos/{repo_name}/pulls/{pr_number}")

            logger.info(
                "[telkins] Fetched PR details from GitHub",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "has_details": bool(pr_details),
                    "pr_title": pr_details.get("title") if pr_details else None,
                },
            )

            return pr_details

        except ApiError as e:
            logger.warning(
                "[telkins] GitHub API error when fetching PR details",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
            )
            return None
        except Exception as e:
            logger.exception(
                "[telkins] Unexpected error fetching PR details",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error_type": type(e).__name__,
                },
            )
            return None


@region_silo_endpoint
class OrganizationPrCommentsEndpoint(OrganizationEndpoint):
    """
    Endpoint to retrieve GitHub comments related to a Pull Request.

    This endpoint fetches both general PR comments and file-specific review comments
    from GitHub for the specified Pull Request.
    """

    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationEventPermission,)

    @extend_schema(
        operation_id="Get Pull Request Comments",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("OrganizationPrComments", dict[str, Any]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[
            {
                "summary": "Get comments for GitHub PR",
                "description": "Returns all comments related to a GitHub PR",
                "value": {
                    "repo": "getsentry/sentry",
                    "pr": "12345",
                },
            }
        ],
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get GitHub comments for a Pull Request.

        Returns both general PR comments and file-specific review comments.

        **Query Parameters:**

        **Required:**
        - `repo`: Repository name (e.g., 'getsentry/sentry') (required)
        - `pr`: Pull request number (required)

        **Example:**
        ```
        GET /organizations/sentry/pr-comments/?repo=getsentry/sentry&pr=12345
        ```
        """
        try:
            # Get required parameters
            repo_name = request.GET.get("repo")
            pr_number = request.GET.get("pr")

            # Validate required parameters
            if not repo_name or not pr_number:
                return Response(
                    {"detail": "Both 'repo' and 'pr' parameters are required"},
                    status=400,
                )

            logger.info(
                "[telkins] PR comments request",
                extra={
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "organization_id": organization.id,
                },
            )

            # Fetch comments from GitHub PR
            general_comments = self._fetch_pr_general_comments(organization, repo_name, pr_number)
            review_comments = self._fetch_pr_review_comments(organization, repo_name, pr_number)

            # Organize review comments by file
            file_comments = {}
            for comment in review_comments:
                filename = comment.get("path")
                if filename:
                    if filename not in file_comments:
                        file_comments[filename] = []
                    file_comments[filename].append(comment)

            response_data = {
                "general_comments": general_comments,
                "file_comments": file_comments,
            }

            logger.info(
                "[telkins] PR comments response",
                extra={
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "organization_id": organization.id,
                    "general_comments_count": len(general_comments),
                    "review_comments_count": len(review_comments),
                    "files_with_comments": len(file_comments),
                },
            )

            return Response(response_data)

        except Exception as e:
            logger.exception(
                "[telkins] Unexpected error in OrganizationPrCommentsEndpoint",
                extra={
                    "organization_id": organization.id,
                    "query_params": dict(request.GET),
                },
            )
            return Response(
                {"detail": f"An error occurred while processing PR comments data: {str(e)}"},
                status=500,
            )

    def _get_github_integration(self, organization: Organization) -> Integration | None:
        """Get the GitHub integration for this organization."""
        try:
            # First try the existing query
            integration = Integration.objects.filter(
                organizationintegration__organization_id=organization.id,
                provider="github",
                status=0,  # ObjectStatus.ACTIVE
            ).first()

            # If not found, try to get integration ID 1 directly since we know it exists
            if not integration:
                try:
                    integration = Integration.objects.get(id=1, provider="github", status=0)
                    logger.info(
                        "[telkins] Using hardcoded integration ID 1 for comments",
                        extra={
                            "organization_id": organization.id,
                            "integration_id": integration.id,
                        },
                    )
                except Integration.DoesNotExist:
                    logger.warning(
                        "[telkins] Integration ID 1 not found for comments",
                        extra={
                            "organization_id": organization.id,
                        },
                    )

            return integration
        except Exception as e:
            logger.warning(
                "[telkins] Failed to get GitHub integration for comments",
                extra={"organization_id": organization.id, "error": str(e)},
            )
            return None

    def _fetch_pr_general_comments(
        self, organization: Organization, repo_name: str, pr_number: str
    ) -> list[dict[str, Any]]:
        """
        Fetch general PR comments from GitHub.

        These are the comments posted in the main PR conversation thread.
        """
        integration = self._get_github_integration(organization)
        if not integration:
            logger.warning(
                "[telkins] No GitHub integration found for PR comments",
                extra={"organization_id": organization.id},
            )
            return []

        try:
            # Create GitHub API client
            client = GitHubApiClient(integration)

            # Fetch general PR comments from GitHub
            comments = client.get(f"/repos/{repo_name}/issues/{pr_number}/comments")

            logger.info(
                "[telkins] Fetched PR general comments from GitHub",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "comment_count": len(comments) if comments else 0,
                },
            )

            return comments or []

        except Exception as e:
            logger.exception(
                "[telkins] Error fetching PR general comments",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error_type": type(e).__name__,
                },
            )
            return []

    def _fetch_pr_review_comments(
        self, organization: Organization, repo_name: str, pr_number: str
    ) -> list[dict[str, Any]]:
        """
        Fetch PR review comments from GitHub.

        These are the comments posted on specific lines in file diffs during code review.
        """
        integration = self._get_github_integration(organization)
        if not integration:
            logger.warning(
                "[telkins] No GitHub integration found for PR review comments",
                extra={"organization_id": organization.id},
            )
            return []

        try:
            # Create GitHub API client
            client = GitHubApiClient(integration)

            # Fetch PR review comments from GitHub
            comments = client.get(f"/repos/{repo_name}/pulls/{pr_number}/comments")

            logger.info(
                "[telkins] Fetched PR review comments from GitHub",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "comment_count": len(comments) if comments else 0,
                },
            )

            return comments or []

        except Exception as e:
            logger.exception(
                "[telkins] Error fetching PR review comments",
                extra={
                    "organization_id": organization.id,
                    "repo_name": repo_name,
                    "pr_number": pr_number,
                    "error_type": type(e).__name__,
                },
            )
            return []
