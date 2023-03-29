from abc import ABC, abstractmethod
from typing import Any, Mapping, Sequence


class SDKCrashDetector(ABC):
    @abstractmethod
    def init(self):
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
