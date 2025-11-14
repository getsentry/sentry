from __future__ import annotations
from typing import int

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class AuthorAssociation(StrEnum):
    """How the author is associated with the repository."""

    COLLABORATOR = "COLLABORATOR"
    CONTRIBUTOR = "CONTRIBUTOR"
    FIRST_TIMER = "FIRST_TIMER"
    FIRST_TIME_CONTRIBUTOR = "FIRST_TIME_CONTRIBUTOR"
    MANNEQUIN = "MANNEQUIN"
    MEMBER = "MEMBER"
    NONE = "NONE"
    OWNER = "OWNER"


class CommentUser(BaseModel):
    """
    Represents a GitHub user who commented.
    Simplified from the full GitHub user schema to include only relevant fields.
    """

    id: int
    login: str
    node_id: str
    avatar_url: str
    gravatar_id: str | None
    url: str
    html_url: str
    followers_url: str
    following_url: str
    gists_url: str
    starred_url: str
    subscriptions_url: str
    organizations_url: str
    repos_url: str
    events_url: str
    received_events_url: str
    type: str
    site_admin: bool
    name: str | None = None
    email: str | None = None
    starred_at: str | None = None
    user_view_type: str | None = None


class CommentReactions(BaseModel):
    """Reaction counts on a comment."""

    url: str
    total_count: int
    plus_one: int = Field(alias="+1")
    minus_one: int = Field(alias="-1")
    laugh: int
    confused: int
    heart: int
    hooray: int
    eyes: int
    rocket: int

    class Config:
        populate_by_name = True  # Allow both alias and field name


class IssueComment(BaseModel):
    """
    Represents a GitHub issue comment (general PR comment).
    These are comments in the main PR conversation thread.
    """

    id: int
    node_id: str
    url: str
    html_url: str
    body: str
    user: CommentUser | None
    created_at: datetime
    updated_at: datetime
    issue_url: str
    author_association: AuthorAssociation
    body_text: str | None = None
    body_html: str | None = None
    reactions: CommentReactions | None = None


class ReviewCommentSide(StrEnum):
    """Which side of the diff the comment is on."""

    LEFT = "LEFT"  # The left side (old code)
    RIGHT = "RIGHT"  # The right side (new code)


class ReviewCommentSubjectType(StrEnum):
    """The level at which the comment is targeted."""

    LINE = "line"  # Comment on a specific line
    FILE = "file"  # Comment on the entire file


class ReviewCommentLinkObject(BaseModel):
    """A link object with an href."""

    href: str


class ReviewCommentLinks(BaseModel):
    """Links related to the review comment."""

    self_link: ReviewCommentLinkObject = Field(alias="self")
    html: ReviewCommentLinkObject
    pull_request: ReviewCommentLinkObject

    class Config:
        populate_by_name = True


class ReviewComment(BaseModel):
    """
    Represents a GitHub review comment (file-specific comment).
    These are comments on specific lines in the code during review.
    """

    id: int
    node_id: str
    url: str
    html_url: str
    body: str
    path: str
    user: CommentUser
    created_at: datetime
    updated_at: datetime
    author_association: AuthorAssociation
    commit_id: str
    original_commit_id: str
    diff_hunk: str
    pull_request_url: str
    pull_request_review_id: int | None
    links: ReviewCommentLinks = Field(alias="_links")
    position: int | None = None
    original_position: int | None = None
    line: int | None = None
    original_line: int | None = None
    start_line: int | None = None
    original_start_line: int | None = None
    side: ReviewCommentSide | None = None
    start_side: ReviewCommentSide | None = None
    in_reply_to_id: int | None = None
    subject_type: ReviewCommentSubjectType | None = None
    body_text: str | None = None
    body_html: str | None = None
    reactions: CommentReactions | None = None

    class Config:
        populate_by_name = True


class PullRequestComments(BaseModel):
    """
    Complete comments data for a pull request.
    Organizes both general comments and file-specific review comments.
    """

    general_comments: list[IssueComment]
    file_comments: dict[str, list[ReviewComment]]  # Grouped by file path


class PullRequestCommentsErrorResponse(BaseModel):
    """Error response for pull request comments operations."""

    error: str
    message: str
    details: str | None = None
