from __future__ import annotations

import enum

from sentry.integrations.source_code_management.status_check import StatusCheckStatus


class GitHubCheckStatus(enum.Enum):
    """GitHub Check Run status values."""

    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

    # Can only be set by Github Actions
    WAITING = "waiting"
    PENDING = "pending"
    REQUESTED = "requested"


class GitHubCheckConclusion(enum.Enum):
    """GitHub Check Run conclusion values (when status is completed)."""

    ACTION_REQUIRED = "action_required"
    CANCELLED = "cancelled"
    FAILURE = "failure"
    NEUTRAL = "neutral"
    SKIPPED = "skipped"
    STALE = "stale"
    SUCCESS = "success"
    TIMED_OUT = "timed_out"


GITHUB_STATUS_CHECK_STATUS_MAPPING: dict[StatusCheckStatus, GitHubCheckStatus] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.IN_PROGRESS: GitHubCheckStatus.IN_PROGRESS,
    StatusCheckStatus.FAILURE: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.NEUTRAL: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.SUCCESS: GitHubCheckStatus.COMPLETED,
    StatusCheckStatus.TIMED_OUT: GitHubCheckStatus.COMPLETED,
}

GITHUB_STATUS_CHECK_CONCLUSION_MAPPING: dict[StatusCheckStatus, GitHubCheckConclusion | None] = {
    StatusCheckStatus.ACTION_REQUIRED: GitHubCheckConclusion.ACTION_REQUIRED,
    StatusCheckStatus.IN_PROGRESS: None,
    StatusCheckStatus.FAILURE: GitHubCheckConclusion.FAILURE,
    StatusCheckStatus.NEUTRAL: GitHubCheckConclusion.NEUTRAL,
    StatusCheckStatus.SUCCESS: GitHubCheckConclusion.SUCCESS,
    StatusCheckStatus.TIMED_OUT: GitHubCheckConclusion.TIMED_OUT,
}
