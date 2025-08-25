from __future__ import annotations

import enum
from typing import Any


class CommitStatus(enum.Enum):
    """Common commit status states across different SCM providers."""

    PENDING = "pending"
    """The status check is in progress."""

    SUCCESS = "success"
    """The status check completed successfully."""

    FAILURE = "failure"
    """The status check failed."""

    ERROR = "error"
    """The status check encountered an error."""

    CANCELED = "canceled"
    """The status check was canceled."""


class GitHubCheckStatus(enum.Enum):
    """GitHub Check Run status values."""

    QUEUED = "queued"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class GitHubCheckConclusion(enum.Enum):
    """GitHub Check Run conclusion values (when status is completed)."""

    SUCCESS = "success"
    FAILURE = "failure"
    NEUTRAL = "neutral"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"
    ACTION_REQUIRED = "action_required"
    SKIPPED = "skipped"


class GitHubStatusMapper:
    """Maps CommitStatus values to GitHub Check Runs API values."""

    @classmethod
    def to_check_run_data(cls, status: CommitStatus) -> dict[str, Any]:
        """Convert CommitStatus to GitHub Check Run status/conclusion."""
        if status == CommitStatus.PENDING:
            return {"status": GitHubCheckStatus.IN_PROGRESS.value}
        elif status == CommitStatus.SUCCESS:
            return {
                "status": GitHubCheckStatus.COMPLETED.value,
                "conclusion": GitHubCheckConclusion.SUCCESS.value,
            }
        elif status == CommitStatus.FAILURE:
            return {
                "status": GitHubCheckStatus.COMPLETED.value,
                "conclusion": GitHubCheckConclusion.FAILURE.value,
            }
        elif status == CommitStatus.ERROR:
            return {
                "status": GitHubCheckStatus.COMPLETED.value,
                "conclusion": GitHubCheckConclusion.FAILURE.value,
            }
        elif status == CommitStatus.CANCELED:
            return {
                "status": GitHubCheckStatus.COMPLETED.value,
                "conclusion": GitHubCheckConclusion.CANCELLED.value,
            }
        else:
            # Fallback
            return {"status": GitHubCheckStatus.IN_PROGRESS.value}

    @classmethod
    def to_provider_status(cls, status: CommitStatus) -> str:
        """Legacy method for commit status API - kept for compatibility."""
        mapping = {
            CommitStatus.PENDING: "pending",
            CommitStatus.SUCCESS: "success",
            CommitStatus.FAILURE: "failure",
            CommitStatus.ERROR: "error",
            CommitStatus.CANCELED: "failure",
        }
        return mapping[status]


class GitLabStatusMapper:
    """Maps CommitStatus values to GitLab API status values."""

    MAPPING = {
        CommitStatus.PENDING: "running",
        CommitStatus.SUCCESS: "success",
        CommitStatus.FAILURE: "failed",
        CommitStatus.ERROR: "failed",
        CommitStatus.CANCELED: "canceled",
    }

    @classmethod
    def to_provider_status(cls, status: CommitStatus) -> str:
        return cls.MAPPING[status]
