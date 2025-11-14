import enum
from abc import ABC, abstractmethod
from typing import int, Any


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
