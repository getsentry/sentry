from __future__ import annotations

from enum import StrEnum


class CodeReviewEventStatus(StrEnum):
    WEBHOOK_RECEIVED = "webhook_received"
    PREFLIGHT_DENIED = "preflight_denied"
    WEBHOOK_FILTERED = "webhook_filtered"
    TASK_ENQUEUED = "task_enqueued"
    SENT_TO_SEER = "sent_to_seer"
    REVIEW_STARTED = "review_started"
    REVIEW_COMPLETED = "review_completed"
    REVIEW_FAILED = "review_failed"

    @classmethod
    def as_choices(cls) -> tuple[tuple[str, str], ...]:
        return tuple((status.value, status.value) for status in cls)
