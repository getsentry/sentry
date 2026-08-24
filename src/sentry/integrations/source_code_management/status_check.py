import enum
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any


class StatusCheckStatus(str, enum.Enum):
    """
    A subset of possible status values for a status check that is compatible across various providers.
    For example, Github uses more state/conclusion values that won't map over to everything.
    If needed, use those directly.
    """

    ACTION_REQUIRED = "action_required"
    IN_PROGRESS = "in_progress"
    FAILURE = "failure"
    NEUTRAL = "neutral"
    SUCCESS = "success"


class StatusCheckClient(ABC):
    base_url: str

    @abstractmethod
    def create_check_run(self, repo: str, data: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_check_runs(self, repo: str, sha: str) -> Any:
        raise NotImplementedError


class AggregateChecksStatus(enum.StrEnum):
    """
    The provider's roll-up of every check on a pull request into one state.
    StatusCheckStatus above is the state of a single check Sentry writes; this is
    every check read back.

    A repository without CI has no state at all rather than a member here, so
    that it does not read as perpetually pending.
    """

    SUCCESS = "success"
    FAILURE = "failure"
    PENDING = "pending"


class AggregateReviewStatus(enum.StrEnum):
    """The provider's effective review decision for a pull request."""

    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"
    REVIEW_REQUIRED = "review_required"


@dataclass(frozen=True)
class PullRequestFileSummary:
    """One changed file, without its contents."""

    path: str
    additions: int
    deletions: int
    change_type: str


@dataclass(frozen=True)
class PullRequestStatusResult:
    """A pull request's checks and review state, as far as the provider reports it."""

    checks: AggregateChecksStatus | None = None
    review: AggregateReviewStatus | None = None
    files: tuple[PullRequestFileSummary, ...] = ()
    failed_checks: tuple[str, ...] = ()


@dataclass(frozen=True)
class PullRequestStatusRequest:
    repo: str
    pull_number: str
    include_files: bool = False


class PullRequestStatusClient(ABC):
    @abstractmethod
    def get_pull_request_statuses(
        self, pull_requests: Sequence[PullRequestStatusRequest]
    ) -> dict[PullRequestStatusRequest, PullRequestStatusResult]:
        raise NotImplementedError

    def get_pull_request_status(self, repo: str, pull_number: str) -> PullRequestStatusResult:
        request = PullRequestStatusRequest(repo=repo, pull_number=pull_number)
        return self.get_pull_request_statuses([request]).get(request, PullRequestStatusResult())
