from abc import ABC, abstractmethod
from typing import Any, Mapping, Sequence, Set

from sentry.db.models import NodeData


class SDKCrashDetector(ABC):
    @property
    def fields_containing_paths(self) -> Set[str]:
        return {"package", "module", "abs_path"}

    @abstractmethod
    def should_detect_sdk_crash(self, event_data: NodeData) -> bool:
        raise NotImplementedError

    @abstractmethod
    def is_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        """
        Returns true if the stacktrace stems from an SDK crash.

        :param frames: The stacktrace frames ordered from newest to oldest.
        """
        raise NotImplementedError

    @abstractmethod
    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        raise NotImplementedError

    @abstractmethod
    def is_system_library_frame(self, frame: Mapping[str, Any]) -> bool:
        raise NotImplementedError
