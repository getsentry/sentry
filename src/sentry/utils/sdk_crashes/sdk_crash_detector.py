from dataclasses import dataclass
from typing import Any, Mapping, Sequence, Set

from packaging.version import InvalidVersion, Version

from sentry.db.models import NodeData
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.path_replacer import PathReplacer


@dataclass
class SDKFrameConfig:
    function_patterns: Set[str]

    filename_patterns: Set[str]

    path_replacer: PathReplacer


@dataclass
class SDKCrashDetectorConfig:
    sdk_names: Sequence[str]

    min_sdk_version: str

    system_library_paths: Set[str]

    sdk_frame_config: SDKFrameConfig

    sdk_crash_ignore_functions_matchers: Set[str]


class SDKCrashDetector:
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
        return {"package", "module", "abs_path", "filename"}

    def replace_sdk_frame_path(self, path: str) -> str:
        return self.config.sdk_frame_config.path_replacer.replace_path(path)

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

    def is_sdk_crash(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        """
        Returns true if the stacktrace stems from an SDK crash.

        :param frames: The stacktrace frames ordered from newest to oldest.
        """

        if not frames:
            return False

        # The frames are ordered from caller to callee, or oldest to youngest.
        # The last frame is the one creating the exception.
        # Therefore, we must iterate in reverse order.
        # In a first iteration of this algorithm, we checked for in_app frames, but
        # customers can change the in_app configuration, so we can't rely on that.
        # Furthermore, if they use static linking for including, for example, the Sentry Cocoa,
        # Cocoa SDK frames can be marked as in_app. Therefore, the algorithm only checks if frames
        # are SDK frames or from system libraries.
        for frame in reversed(frames):
            function = frame.get("function")
            if function:
                for matcher in self.config.sdk_crash_ignore_functions_matchers:
                    if glob_match(function, matcher, ignorecase=True):
                        return False

            if self.is_sdk_frame(frame):
                return True

            if not self.is_system_library_frame(frame):
                return False

        return False

    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        """
        Returns true if frame is an SDK frame.

        :param frame: The frame of a stacktrace.
        """

        function = frame.get("function")
        if function:
            for patterns in self.config.sdk_frame_config.function_patterns:
                if glob_match(function, patterns, ignorecase=True):
                    return True

        filename = frame.get("filename")
        if filename:
            for patterns in self.config.sdk_frame_config.filename_patterns:
                if glob_match(filename, patterns, ignorecase=True):
                    return True

        return False

    def is_system_library_frame(self, frame: Mapping[str, Any]) -> bool:
        for field in self.fields_containing_paths:
            for system_library_path in self.config.system_library_paths:
                field_with_path = frame.get(field)
                if field_with_path and field_with_path.startswith(system_library_path):
                    return True

        return False
