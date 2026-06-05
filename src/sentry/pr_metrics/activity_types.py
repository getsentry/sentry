from __future__ import annotations

from dataclasses import dataclass, field

# Known values from GitHub webhook schema: "Bot", "User", "Organization".
# Typed as str to remain forward-compatible with enterprise account types
# (e.g. "EnterpriseUserAccount" on GHEC/EMU).
GithubSenderType = str

# Known values: "OWNER", "MEMBER", "COLLABORATOR", "CONTRIBUTOR",
# "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", "NONE".
GithubAuthorAssociation = str


@dataclass
class BaseActivityPayload:
    """Structural metadata common to every GitHub PR activity row.

    Titles, bodies, and comment text are intentionally absent — excluded at
    the type level rather than filtered by hand.
    """

    action: str = ""
    # GitHub user ID of the account that triggered the webhook action (the
    # sender field in the event payload, not necessarily the PR author).
    sender_id: int = 0
    sender_type: GithubSenderType = "User"
    head_sha: str | None = None
    base_sha: str | None = None


@dataclass
class OpenedPayload(BaseActivityPayload):
    action: str = "opened"
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    commits: int = 0


@dataclass
class ClosedPayload(BaseActivityPayload):
    action: str = "closed"
    merged: bool = False
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    commits: int = 0
    comments: int = 0
    review_comments: int = 0
    # GitHub user ID of the account that merged the PR; None when not merged.
    merged_by_id: int | None = None


@dataclass
class ReopenedPayload(BaseActivityPayload):
    action: str = "reopened"
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    commits: int = 0


@dataclass
class SynchronizePayload(BaseActivityPayload):
    action: str = "synchronize"
    before: str | None = None  # head SHA before the push
    after: str | None = None  # head SHA after the push


@dataclass
class EditedPayload(BaseActivityPayload):
    action: str = "edited"
    # Names of changed properties (keys from the webhook changes dict),
    # not their values — deliberately excludes the old title/body text.
    changed_fields: list[str] = field(default_factory=list)


@dataclass
class LabeledPayload(BaseActivityPayload):
    action: str = "labeled"
    label_name: str = ""


@dataclass
class UnlabeledPayload(BaseActivityPayload):
    action: str = "unlabeled"
    label_name: str = ""


@dataclass
class ReviewRequestedPayload(BaseActivityPayload):
    action: str = "review_requested"
    # True when a team was requested; False for an individual reviewer.
    is_team_review: bool = False


@dataclass
class ReviewRequestRemovedPayload(BaseActivityPayload):
    action: str = "review_request_removed"
    is_team_review: bool = False


@dataclass
class CommentCreatedPayload(BaseActivityPayload):
    action: str = "comment_created"
    author_association: GithubAuthorAssociation = "NONE"


@dataclass
class CommentEditedPayload(BaseActivityPayload):
    action: str = "comment_edited"
    author_association: GithubAuthorAssociation = "NONE"


@dataclass
class ConvertedToDraftPayload(BaseActivityPayload):
    action: str = "converted_to_draft"


@dataclass
class ReadyForReviewPayload(BaseActivityPayload):
    action: str = "ready_for_review"


@dataclass
class AssignedPayload(BaseActivityPayload):
    action: str = "assigned"
    # GitHub user ID of the account that was added as an assignee.
    assignee_id: int = 0


@dataclass
class UnassignedPayload(BaseActivityPayload):
    action: str = "unassigned"
    assignee_id: int = 0
