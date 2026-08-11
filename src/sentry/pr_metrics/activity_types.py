from __future__ import annotations

from dataclasses import dataclass, field

# Known values: "Bot", "User", "Organization".
# Typed as str to remain forward-compatible with enterprise account types
# (e.g. "EnterpriseUserAccount" on GHEC/EMU).
SenderType = str

# Known values: "OWNER", "MEMBER", "COLLABORATOR", "CONTRIBUTOR",
# "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", "NONE".
AuthorAssociation = str


@dataclass
class BaseActivityPayload:
    """Structural metadata common to every PR activity row.

    Titles, bodies, and comment text are intentionally absent — excluded at
    the type level rather than filtered by hand.
    """

    action: str = ""


@dataclass
class SenderMixin:
    """Mixin for payload types that record who triggered the webhook action."""

    # Login of the account that triggered the webhook action (the
    # sender field in the event payload, not necessarily the PR author).
    sender_login: str = ""
    sender_type: SenderType = ""


@dataclass
class OpenedPayload(BaseActivityPayload, SenderMixin):
    action: str = "opened"
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    commits: int = 0
    head_sha: str | None = None
    base_sha: str | None = None
    # Visibility of the repo the webhook fired for, straight off the payload's
    # top-level ``repository.private`` — the only point in the PR's lifecycle
    # where Sentry observes this, since ``Repository`` never persists it.
    is_private: bool | None = None


@dataclass
class SynchronizePayload(BaseActivityPayload, SenderMixin):
    action: str = "synchronize"
    before_sha: str | None = None  # head SHA before the push
    after_sha: str | None = None  # head SHA after the push


@dataclass
class ReopenedPayload(BaseActivityPayload, SenderMixin):
    action: str = "reopened"


@dataclass
class EditedPayload(BaseActivityPayload, SenderMixin):
    action: str = "edited"
    # Names of the changed PR properties (the keys of the webhook ``changes``
    # object — e.g. ``["base", "title"]``), never their values: ``changes`` carries
    # the OLD title/body text, which the structural-only posture excludes.
    changed_fields: list[str] = field(default_factory=list)


@dataclass
class LabeledPayload(BaseActivityPayload, SenderMixin):
    action: str = "labeled"
    label_name: str = ""


@dataclass
class UnlabeledPayload(BaseActivityPayload, SenderMixin):
    action: str = "unlabeled"
    label_name: str = ""


@dataclass
class ReviewRequestedPayload(BaseActivityPayload, SenderMixin):
    action: str = "review_requested"
    # True when a team was requested; False for an individual reviewer.
    is_team_review: bool = False


@dataclass
class ReviewRequestRemovedPayload(BaseActivityPayload, SenderMixin):
    action: str = "review_request_removed"
    is_team_review: bool = False


@dataclass
class CommentCreatedPayload(BaseActivityPayload, SenderMixin):
    action: str = "comment_created"
    author_association: AuthorAssociation = "NONE"
    is_review: bool = False
    review_id: int | None = None


@dataclass
class ConvertedToDraftPayload(BaseActivityPayload, SenderMixin):
    action: str = "converted_to_draft"


@dataclass
class ReadyForReviewPayload(BaseActivityPayload, SenderMixin):
    action: str = "ready_for_review"


@dataclass
class ClosedPayload(BaseActivityPayload, SenderMixin):
    # GitHub fires one "closed" action for both outcomes; a set ``merged_at`` on the
    # PR row disambiguates. This payload is the closed-without-merge case, so the
    # sender is whoever closed the PR (Bot vs human is the human-involvement signal).
    action: str = "closed"


@dataclass
class MergedPayload(BaseActivityPayload, SenderMixin):
    # The merged case of GitHub's "closed" action: the sender is whoever merged the
    # PR (or the app, for auto-merge).
    action: str = "merged"


@dataclass
class AssignedPayload(BaseActivityPayload, SenderMixin):
    action: str = "assigned"
    # Login of the account that was added as an assignee.
    assignee_login: str = ""


@dataclass
class UnassignedPayload(BaseActivityPayload, SenderMixin):
    action: str = "unassigned"
    assignee_login: str = ""


@dataclass
class ReviewSubmittedPayload(BaseActivityPayload, SenderMixin):
    action: str = ""
    # "approved", "changes_requested", or "commented"
    review_state: str = ""
    review_id: int = 0


@dataclass
class ReviewThreadPayload(BaseActivityPayload, SenderMixin):
    action: str = ""
    # GitHub node_id of the review thread (the thread object has no numeric id).
    thread_id: str = ""
    is_resolved: bool = False


@dataclass
class CheckSuiteCompletedPayload(BaseActivityPayload):
    action: str = "completed"
    # Aggregate outcome of the suite: "success", "failure", "neutral",
    # "cancelled", "timed_out", "action_required", "stale", "skipped",
    # "startup_failure". The judge's "was CI green or red at close" signal.
    conclusion: str = ""
    # Slug of the GitHub App that owns the suite (e.g. "github-actions") —
    # a bounded identifier for the CI provider, never the check's display name.
    app_slug: str = ""
    check_runs_count: int = 0


@dataclass
class CheckRunCompletedPayload(BaseActivityPayload):
    action: str = "completed"
    # Name of the individual check (e.g. "build", "test (3.11)"). A structural
    # label like a status context, not free-form text.
    check_name: str = ""
    # Outcome of this run: same vocabulary as CheckSuiteCompletedPayload.conclusion.
    conclusion: str = ""
    app_slug: str = ""


@dataclass
class ReviewDismissedPayload(BaseActivityPayload, SenderMixin):
    action: str = "dismissed"
    # Numeric id of the dismissed review. The dismissed payload reports the review
    # state only as "dismissed", so the id is what lets the judge correlate this
    # back to the earlier review_submitted row to see what was undone (an approval
    # or a changes-request).
    review_id: int = 0


@dataclass
class AutoMergeEnabledPayload(BaseActivityPayload, SenderMixin):
    action: str = "auto_merge_enabled"
    # "merge", "squash", or "rebase" — a bounded enum; the auto-merge commit
    # title/message are deliberately excluded.
    merge_method: str = ""


@dataclass
class AutoMergeDisabledPayload(BaseActivityPayload, SenderMixin):
    action: str = "auto_merge_disabled"


@dataclass
class EnqueuedPayload(BaseActivityPayload, SenderMixin):
    action: str = "enqueued"


@dataclass
class DequeuedPayload(BaseActivityPayload, SenderMixin):
    action: str = "dequeued"
    # Why GitHub removed the PR from the merge queue (e.g. "MERGE", "CI_FAILURE",
    # "MERGE_CONFLICT", "MANUAL"). A bounded enum carrying the merge-intent signal.
    reason: str = ""
