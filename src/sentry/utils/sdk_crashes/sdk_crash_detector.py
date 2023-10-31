from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping, Sequence, Set

from packaging.version import InvalidVersion, Version

from sentry.db.models import NodeData
from sentry.utils.safe import get_path


@dataclass
class SDKCrashDetectorConfig:
    sdk_names: Sequence[str]

    min_sdk_version: str

    system_library_paths: Set[str]


class SDKCrashDetector(ABC):
    """
    This class is still a work in progress. The plan is that every SDK has to define a subclass of
    this base class to get SDK crash detection up and running. We most likely will have to pull
    out some logic of the CocoaSDKCrashDetector into this class when adding the SDK crash detection
    for another SDK.
    """

    def __init__(
        self,
        config: SDKCrashDetectorConfig,
    ):
        self.config = config

    @property
    def fields_containing_paths(self) -> Set[str]:
        return {"package", "module", "abs_path"}

    def should_detect_sdk_crash(self, event_data: NodeData) -> bool:
        sdk_name = get_path(event_data, "sdk", "name")
        if sdk_name is None or sdk_name not in self.config.sdk_names:
            return False

        sdk_version = get_path(event_data, "sdk", "version")
        if not sdk_version:
            return False

        try:
            minimum_sdk_version = Version(self.config.min_sdk_version)
            actual_sdk_version = Version(sdk_version)

            if actual_sdk_version < minimum_sdk_version:
                return False
        except InvalidVersion:
            return False

        is_unhandled = (
            get_path(event_data, "exception", "values", -1, "mechanism", "handled") is False
        )
        if not is_unhandled:
            return False

        return True

    @abstractmethod
    def is_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        """
        Returns true if the stacktrace stems from an SDK crash.

        :param frames: The stacktrace frames ordered from newest to oldest.
        """
        raise NotImplementedError

    @abstractmethod
    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        """
        Returns true if frame is an SDK frame.

        :param frame: The frame of a stacktrace.
        """
        raise NotImplementedError

    def is_system_library_frame(self, frame: Mapping[str, Any]) -> bool:
        for field in self.fields_containing_paths:
            for system_library_path in self.config.system_library_paths:
                field_with_path = frame.get(field)
                if field_with_path and field_with_path.startswith(system_library_path):
                    return True

        return False
