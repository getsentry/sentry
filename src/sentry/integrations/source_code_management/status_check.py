from abc import ABC, abstractmethod
from typing import Any


class StatusCheckClient(ABC):
    base_url: str

    @abstractmethod
    def create_check_run(self, repo: str, data: dict[str, Any]) -> Any:
        raise NotImplementedError

    @abstractmethod
    def get_check_runs(self, repo: str, sha: str) -> Any:
        raise NotImplementedError
