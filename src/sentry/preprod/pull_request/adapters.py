from __future__ import annotations

import logging
from typing import Any, Literal

from dateutil.parser import parse as parse_datetime

from sentry.preprod.api.models.project_preprod_build_details_models import (
    BuildDetailsApiResponse,
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.build_distribution_utils import annotate_download_count
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.pull_request.types import (
    PullRequestAuthor,
    PullRequestDetails,
    PullRequestErrorResponse,
    PullRequestFileChange,
    PullRequestFileStatus,
    PullRequestWithFiles,
)

logger = logging.getLogger(__name__)


class PullRequestDataAdapter:
    """
    Adapter to convert raw SCM provider data to our normalized format.
    """

    @staticmethod
    def from_github_pr_data(
        pr_data: dict[str, Any], files_data: list[dict[str, Any]], organization_id: int
    ) -> PullRequestWithFiles:
        """Convert GitHub API response to our normalized format."""

        github_user = pr_data.get("user", {})
        if not github_user:
            logger.warning(
                "pr_data.parsing_failure",
                extra={
                    "pr_id": pr_data.get("id"),
                    "pr_number": pr_data.get("number"),
                    "failure_type": "missing_user_data",
                },
            )

        author = PullRequestAuthor(
            id=str(github_user.get("id")) if github_user.get("id") else None,
            username=github_user.get("login"),
            display_name=github_user.get("name"),
            avatar_url=github_user.get("avatar_url"),
        )

        pull_request = PullRequestDetails(
            id=str(pr_data.get("id")) if pr_data.get("id") else None,
            number=pr_data.get("number", 0),
            title=pr_data.get("title"),
            description=pr_data.get("body"),
            state=PullRequestDataAdapter._map_github_pr_state(pr_data),
            author=author,
            source_branch=pr_data.get("head", {}).get("ref"),
            target_branch=pr_data.get("base", {}).get("ref"),
            created_at=PullRequestDataAdapter._safe_parse_datetime(pr_data.get("created_at")),
            updated_at=PullRequestDataAdapter._safe_parse_datetime(pr_data.get("updated_at")),
            merged_at=PullRequestDataAdapter._safe_parse_datetime(pr_data.get("merged_at")),
            closed_at=PullRequestDataAdapter._safe_parse_datetime(pr_data.get("closed_at")),
            url=pr_data.get("html_url"),
            commits_count=pr_data.get("commits", 0),
            additions=pr_data.get("additions", 0),
            deletions=pr_data.get("deletions", 0),
            changed_files_count=pr_data.get("changed_files", 0),
        )

        files: list[PullRequestFileChange] = []
        for file_data in files_data:
            # Validate filename - skip files without valid filenames
            filename = file_data.get("filename")
            if not filename or not isinstance(filename, str):
                logger.warning(
                    "pr_data.parsing_failure",
                    extra={
                        "failure_type": "missing_or_invalid_filename",
                        "file_name": filename,
                        "file_data_keys": list(file_data.keys()) if file_data else None,
                    },
                )
                continue

            # Validate and normalize file status
            raw_status = file_data.get("status")
            if raw_status not in [status.value for status in PullRequestFileStatus]:
                logger.warning(
                    "pr_data.parsing_failure",
                    extra={
                        "failure_type": "unrecognized_file_status",
                        "file_status": raw_status,
                        "file_name": filename,
                    },
                )
                # Skip files with unrecognized status to maintain type safety
                continue

            file_change = PullRequestFileChange(
                filename=filename,
                status=raw_status,
                additions=file_data.get("additions", 0),
                deletions=file_data.get("deletions", 0),
                changes=file_data.get("changes", 0),
                previous_filename=file_data.get("previous_filename"),
                sha=file_data.get("sha"),
                patch=file_data.get("patch"),
            )
            files.append(file_change)

        # Get build details for the head SHA if available
        head_sha = pr_data.get("head", {}).get("sha")
        build_details = []
        if head_sha:
            build_details = PullRequestDataAdapter._get_build_details_for_sha_if_exists(
                head_sha, organization_id
            )

        return PullRequestWithFiles(
            pull_request=pull_request,
            files=files,
            build_details=build_details,
        )

    @staticmethod
    def _get_build_details_for_sha_if_exists(
        head_sha: str, organization_id: int
    ) -> list[BuildDetailsApiResponse]:
        if not head_sha:
            return []

        # Query for preprod artifacts with matching head_sha, prefetching related objects to avoid N+1
        artifacts = list(
            annotate_download_count(
                PreprodArtifact.objects.filter(
                    commit_comparison__head_sha=head_sha,
                    commit_comparison__organization_id=organization_id,
                ).select_related("commit_comparison", "build_configuration")
            )
        )

        if not artifacts:
            logger.info(
                "pr_data.no_matching_artifacts",
                extra={
                    "head_sha": head_sha,
                    "organization_id": organization_id,
                    "reason": "no_matching_artifacts",
                },
            )
            return []

        return [transform_preprod_artifact_to_build_details(artifact) for artifact in artifacts]

    @staticmethod
    def create_error_response(
        error: str, message: str, details: str | None = None
    ) -> PullRequestErrorResponse:
        return PullRequestErrorResponse(
            error=error,
            message=message,
            details=details,
        )

    @staticmethod
    def _map_github_pr_state(
        pr_data: dict[str, Any],
    ) -> Literal["open", "closed", "merged", "draft"]:
        if pr_data.get("draft", False):
            return "draft"
        elif pr_data.get("merged", False):
            return "merged"
        elif pr_data.get("state") == "open":
            return "open"
        elif pr_data.get("state") == "closed":
            return "closed"
        else:
            github_state = pr_data.get("state")
            logger.warning(
                "pr_data.parsing_failure",
                extra={
                    "github_state": github_state,
                    "failure_type": "unrecognized_state",
                },
            )
            return "open"

    @staticmethod
    def _safe_parse_datetime(date_str: str | None) -> Any:
        if not date_str:
            return None

        try:
            return parse_datetime(date_str)
        except Exception:
            logger.warning(
                "pr_data.parsing_failure",
                extra={
                    "failure_type": "datetime_parsing_error",
                    "date_str": date_str,
                },
            )
            return None
