from __future__ import annotations

from typing import Any

from sentry.preprod.pull_request.comment_types import (
    IssueComment,
    PullRequestComments,
    PullRequestCommentsErrorResponse,
    ReviewComment,
)


class PullRequestCommentsAdapter:
    """
    Adapter to convert GitHub API responses to typed comment models.
    """

    @staticmethod
    def from_github_issue_comment(comment_data: dict[str, Any]) -> IssueComment:
        return IssueComment.parse_obj(comment_data)

    @staticmethod
    def from_github_review_comment(comment_data: dict[str, Any]) -> ReviewComment:
        return ReviewComment.parse_obj(comment_data)

    @staticmethod
    def from_github_comments(
        general_comments_data: list[dict[str, Any]],
        review_comments_data: list[dict[str, Any]],
    ) -> PullRequestComments:
        general_comments = [
            PullRequestCommentsAdapter.from_github_issue_comment(comment)
            for comment in general_comments_data
        ]

        file_comments: dict[str, list[ReviewComment]] = {}
        for comment_data in review_comments_data:
            if "path" not in comment_data:
                continue

            review_comment = PullRequestCommentsAdapter.from_github_review_comment(comment_data)
            file_path = review_comment.path

            if file_path not in file_comments:
                file_comments[file_path] = []
            file_comments[file_path].append(review_comment)

        return PullRequestComments(
            general_comments=general_comments,
            file_comments=file_comments,
        )

    @staticmethod
    def create_error_response(
        error: str, message: str, details: str | None = None
    ) -> PullRequestCommentsErrorResponse:
        return PullRequestCommentsErrorResponse(
            error=error,
            message=message,
            details=details,
        )
