from __future__ import annotations

import enum


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
