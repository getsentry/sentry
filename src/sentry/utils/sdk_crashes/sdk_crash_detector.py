from abc import ABC, abstractmethod


class SDKCrashDetector(ABC):
    @abstractmethod
    def is_sdk_crash(self) -> bool:
        """
        Returns true if the stacktrace stems from an SDK crash.

        :param frames: The stacktrace frames ordered from newest to oldest.
        """
        raise NotImplementedError

    @abstractmethod
    def is_sdk_frame(self) -> bool:
        raise NotImplementedError
