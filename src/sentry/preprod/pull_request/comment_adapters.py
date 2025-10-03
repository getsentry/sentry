from __future__ import annotations

from typing import Any

from sentry.preprod.pull_request.comment_types import (
    AuthorAssociation,
    CommentReactions,
    CommentUser,
    IssueComment,
    PullRequestComments,
    PullRequestCommentsErrorResponse,
    ReviewComment,
    ReviewCommentLinkObject,
    ReviewCommentLinks,
    ReviewCommentSide,
    ReviewCommentSubjectType,
)


class PullRequestCommentsAdapter:
    """
    Adapter to convert GitHub API responses to typed comment models.
    """

    @staticmethod
    def from_github_user(user_data: dict[str, Any] | None) -> CommentUser | None:
        """Convert GitHub user data to CommentUser model."""
        if not user_data:
            return None

        return CommentUser(
            id=user_data["id"],
            login=user_data["login"],
            node_id=user_data["node_id"],
            avatar_url=user_data["avatar_url"],
            gravatar_id=user_data.get("gravatar_id"),
            url=user_data["url"],
            html_url=user_data["html_url"],
            followers_url=user_data["followers_url"],
            following_url=user_data["following_url"],
            gists_url=user_data["gists_url"],
            starred_url=user_data["starred_url"],
            subscriptions_url=user_data["subscriptions_url"],
            organizations_url=user_data["organizations_url"],
            repos_url=user_data["repos_url"],
            events_url=user_data["events_url"],
            received_events_url=user_data["received_events_url"],
            type=user_data["type"],
            site_admin=user_data["site_admin"],
            name=user_data.get("name"),
            email=user_data.get("email"),
            starred_at=user_data.get("starred_at"),
            user_view_type=user_data.get("user_view_type"),
        )

    @staticmethod
    def from_github_reactions(reactions_data: dict[str, Any] | None) -> CommentReactions | None:
        """Convert GitHub reactions data to CommentReactions model."""
        if not reactions_data:
            return None

        return CommentReactions(
            url=reactions_data["url"],
            total_count=reactions_data["total_count"],
            **{"+1": reactions_data["+1"]},  # Use dict unpacking for aliased fields
            **{"-1": reactions_data["-1"]},
            laugh=reactions_data["laugh"],
            confused=reactions_data["confused"],
            heart=reactions_data["heart"],
            hooray=reactions_data["hooray"],
            eyes=reactions_data["eyes"],
            rocket=reactions_data["rocket"],
        )

    @staticmethod
    def from_github_issue_comment(comment_data: dict[str, Any]) -> IssueComment:
        """Convert GitHub issue comment to IssueComment model."""
        return IssueComment(
            id=comment_data["id"],
            node_id=comment_data["node_id"],
            url=comment_data["url"],
            html_url=comment_data["html_url"],
            body=comment_data["body"],
            user=PullRequestCommentsAdapter.from_github_user(comment_data.get("user")),
            created_at=comment_data["created_at"],
            updated_at=comment_data["updated_at"],
            issue_url=comment_data["issue_url"],
            author_association=AuthorAssociation(comment_data["author_association"]),
            body_text=comment_data.get("body_text"),
            body_html=comment_data.get("body_html"),
            reactions=PullRequestCommentsAdapter.from_github_reactions(
                comment_data.get("reactions")
            ),
        )

    @staticmethod
    def from_github_links(links_data: dict[str, Any]) -> ReviewCommentLinks:
        """Convert GitHub links data to ReviewCommentLinks model."""
        return ReviewCommentLinks(
            **{
                "self": ReviewCommentLinkObject(href=links_data["self"]["href"]),
                "html": ReviewCommentLinkObject(href=links_data["html"]["href"]),
                "pull_request": ReviewCommentLinkObject(href=links_data["pull_request"]["href"]),
            }
        )

    @staticmethod
    def from_github_review_comment(comment_data: dict[str, Any]) -> ReviewComment:
        """Convert GitHub review comment to ReviewComment model."""
        side = comment_data.get("side")
        start_side = comment_data.get("start_side")
        subject_type = comment_data.get("subject_type")

        return ReviewComment(
            **{
                "id": comment_data["id"],
                "node_id": comment_data["node_id"],
                "url": comment_data["url"],
                "html_url": comment_data["html_url"],
                "body": comment_data["body"],
                "path": comment_data["path"],
                "user": PullRequestCommentsAdapter.from_github_user(comment_data["user"]),
                "created_at": comment_data["created_at"],
                "updated_at": comment_data["updated_at"],
                "author_association": AuthorAssociation(comment_data["author_association"]),
                "commit_id": comment_data["commit_id"],
                "original_commit_id": comment_data["original_commit_id"],
                "diff_hunk": comment_data["diff_hunk"],
                "pull_request_url": comment_data["pull_request_url"],
                "pull_request_review_id": comment_data.get("pull_request_review_id"),
                "_links": PullRequestCommentsAdapter.from_github_links(comment_data["_links"]),
                "position": comment_data.get("position"),
                "original_position": comment_data.get("original_position"),
                "line": comment_data.get("line"),
                "original_line": comment_data.get("original_line"),
                "start_line": comment_data.get("start_line"),
                "original_start_line": comment_data.get("original_start_line"),
                "side": ReviewCommentSide(side) if side else None,
                "start_side": ReviewCommentSide(start_side) if start_side else None,
                "in_reply_to_id": comment_data.get("in_reply_to_id"),
                "subject_type": ReviewCommentSubjectType(subject_type) if subject_type else None,
                "body_text": comment_data.get("body_text"),
                "body_html": comment_data.get("body_html"),
                "reactions": PullRequestCommentsAdapter.from_github_reactions(
                    comment_data.get("reactions")
                ),
            }
        )

    @staticmethod
    def from_github_comments(
        general_comments_data: list[dict[str, Any]],
        review_comments_data: list[dict[str, Any]],
    ) -> PullRequestComments:
        """
        Convert raw GitHub API responses to typed PullRequestComments model.

        Args:
            general_comments_data: Raw issue comments from GitHub API
            review_comments_data: Raw review comments from GitHub API

        Returns:
            Typed PullRequestComments with comments organized by file
        """
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
        """Create a typed error response."""
        return PullRequestCommentsErrorResponse(
            error=error,
            message=message,
            details=details,
        )
