from enum import StrEnum


class EventType(StrEnum):
    CHECK_RUN = "ci_check"
    ISSUE_COMMENT = "issue_comment"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    PULL_REQUEST_REVIEW_COMMENT = "pull_request_review_comment"

    @classmethod
    def from_string(cls, value: str) -> "EventType":
        try:
            return cls(value)
        except ValueError:
            raise ValueError(f"Invalid event type: {value}")
