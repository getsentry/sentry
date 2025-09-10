from __future__ import annotations

from datetime import datetime

from dateutil.parser import parse as parse_datetime
from rest_framework import serializers

from sentry.preprod.pull_request.types import (
    PullRequestAuthor,
    PullRequestDetails,
    PullRequestErrorResponse,
    PullRequestFileChange,
    PullRequestWithFiles,
)


class PullRequestAuthorSerializer(serializers.Serializer):
    """Serializer for pull request author data."""

    id = serializers.CharField()
    username = serializers.CharField()
    display_name = serializers.CharField(allow_null=True)
    avatar_url = serializers.URLField(allow_null=True, required=False)


class PullRequestFileChangeSerializer(serializers.Serializer):
    """Serializer for pull request file changes."""

    filename = serializers.CharField()
    status = serializers.ChoiceField(choices=["added", "modified", "removed", "renamed"])
    additions = serializers.IntegerField(min_value=0)
    deletions = serializers.IntegerField(min_value=0)
    changes = serializers.IntegerField(min_value=0)
    previous_filename = serializers.CharField(allow_null=True, required=False)
    sha = serializers.CharField(allow_null=True, required=False)
    patch = serializers.CharField(allow_null=True, required=False)


class PullRequestDetailsSerializer(serializers.Serializer):
    """Serializer for pull request details."""

    id = serializers.CharField()
    number = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    state = serializers.ChoiceField(choices=["open", "closed", "merged", "draft"])
    author = PullRequestAuthorSerializer()
    source_branch = serializers.CharField()
    target_branch = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    merged_at = serializers.DateTimeField(allow_null=True)
    closed_at = serializers.DateTimeField(allow_null=True)
    url = serializers.URLField()
    commits_count = serializers.IntegerField(min_value=0)
    additions = serializers.IntegerField(min_value=0)
    deletions = serializers.IntegerField(min_value=0)
    changed_files_count = serializers.IntegerField(min_value=0)


class PullRequestWithFilesSerializer(serializers.Serializer):
    """Serializer for complete pull request data including file changes."""

    pull_request = PullRequestDetailsSerializer()
    files = PullRequestFileChangeSerializer(many=True)


class PullRequestErrorResponseSerializer(serializers.Serializer):
    """Serializer for pull request error responses."""

    error = serializers.CharField()
    message = serializers.CharField()
    details = serializers.CharField(allow_null=True, required=False)


class PullRequestDataAdapter:
    """
    Adapter to convert raw SCM provider data to our normalized format.
    """

    @staticmethod
    def from_github_pr_data(pr_data: dict, files_data: list[dict]) -> PullRequestWithFiles:
        """Convert GitHub API response to our normalized format."""

        github_user = pr_data.get("user", {})
        author: PullRequestAuthor = {
            "id": str(github_user.get("id", "")),
            "username": github_user.get("login", ""),
            "display_name": github_user.get("name"),
            "avatar_url": github_user.get("avatar_url"),
        }

        pull_request: PullRequestDetails = {
            "id": str(pr_data.get("id", "")),
            "number": pr_data.get("number", 0),
            "title": pr_data.get("title", ""),
            "description": pr_data.get("body"),
            "state": pr_data.get("state", "open"),
            "author": author,
            "source_branch": pr_data.get("head", {}).get("ref", ""),
            "target_branch": pr_data.get("base", {}).get("ref", ""),
            "created_at": (
                parse_datetime(pr_data["created_at"])
                if pr_data.get("created_at")
                else datetime.now()
            ),
            "updated_at": (
                parse_datetime(pr_data["updated_at"])
                if pr_data.get("updated_at")
                else datetime.now()
            ),
            "merged_at": parse_datetime(pr_data["merged_at"]) if pr_data.get("merged_at") else None,
            "closed_at": parse_datetime(pr_data["closed_at"]) if pr_data.get("closed_at") else None,
            "url": pr_data.get("html_url", ""),
            "commits_count": pr_data.get("commits", 0),
            "additions": pr_data.get("additions", 0),
            "deletions": pr_data.get("deletions", 0),
            "changed_files_count": pr_data.get("changed_files", 0),
        }

        files: list[PullRequestFileChange] = []
        for file_data in files_data:
            file_change: PullRequestFileChange = {
                "filename": file_data.get("filename", ""),
                "status": file_data.get("status", "modified"),
                "additions": file_data.get("additions", 0),
                "deletions": file_data.get("deletions", 0),
                "changes": file_data.get("changes", 0),
                "previous_filename": file_data.get("previous_filename"),
                "sha": file_data.get("sha"),
                "patch": file_data.get("patch"),
            }
            files.append(file_change)

        return {
            "pull_request": pull_request,
            "files": files,
        }

    @staticmethod
    def create_error_response(
        error: str, message: str, details: str | None = None
    ) -> PullRequestErrorResponse:
        """Create a standardized error response."""
        return {
            "error": error,
            "message": message,
            "details": details,
        }
