from collections.abc import Mapping, Sequence
from typing import Any

from packaging.version import InvalidVersion, Version

from sentry.db.models import NodeData
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detection_config import SDKCrashDetectionConfig


class SDKCrashDetector:
    def __init__(
        self,
        config: SDKCrashDetectionConfig,
    ):
        self.config = config

    @property
    def fields_containing_paths(self) -> set[str]:
        return {"package", "module", "path", "abs_path", "filename"}

    def replace_sdk_frame_path(self, path_field: str, path_value: str) -> str | None:
        return self.config.sdk_frame_config.path_replacer.replace_path(path_field, path_value)

    def is_sdk_supported(
        self,
        sdk_name: str,
        sdk_version: str,
    ) -> bool:
        minimum_sdk_version_string = self.config.sdk_names.get(sdk_name)
        if not minimum_sdk_version_string:
            return False

        try:
            minimum_sdk_version = Version(minimum_sdk_version_string)
            actual_sdk_version = Version(sdk_version)

            if actual_sdk_version < minimum_sdk_version:
                return False
        except InvalidVersion:
            return False

        return True

    def should_detect_sdk_crash(
        self, sdk_name: str, sdk_version: str, event_data: NodeData
    ) -> bool:
        if not self.is_sdk_supported(sdk_name, sdk_version):
            return False

        mechanism_type = get_path(event_data, "exception", "values", -1, "mechanism", "type")
        if mechanism_type and mechanism_type in self.config.ignore_mechanism_type:
            return False

        if mechanism_type and mechanism_type in self.config.allow_mechanism_type:
            return True

        is_unhandled = (
            get_path(event_data, "exception", "values", -1, "mechanism", "handled") is False
        )
        if is_unhandled:
            return True

        is_fatal = get_path(event_data, "level") == "fatal"
        if is_fatal and self.config.report_fatal_errors:
            return True

        return False

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
        iter_frames = [f for f in reversed(frames) if f is not None]

        # First pass: Check if we have any SDK frames that are NOT conditional (like SentrySwizzleWrapper).
        # We prefer to overreport rather than underreport SDK crashes, so if there's any other
        # SDK frame anywhere in the stacktrace, we should report it.
        has_non_conditional_sdk_frame = False
        for frame in iter_frames:
            if self.is_sdk_frame(frame) and not self._matches_ignore_when_only_sdk_frame(frame):
                has_non_conditional_sdk_frame = True
                break

        for frame in iter_frames:
            function = frame.get("function")
            module = frame.get("module")

            if function:
                for matcher in self.config.sdk_crash_ignore_matchers:
                    function_matches = glob_match(
                        function, matcher.function_pattern, ignorecase=True
                    )
                    module_matches = glob_match(module, matcher.module_pattern, ignorecase=True)

                    if function_matches and module_matches:
                        return False

            if self.is_sdk_frame(frame):
                # Check if this SDK frame matches the "ignore when only SDK frame" pattern.
                # These are instrumentation frames (like swizzling or monkey patching) that
                # don't cause crashes themselves.
                if self._matches_ignore_when_only_sdk_frame(frame):
                    # Found a conditional SDK frame (like SentrySwizzleWrapper).
                    # Only ignore it if there are no other SDK frames anywhere in the stacktrace.
                    # We prefer to overreport rather than underreport SDK crashes.
                    if has_non_conditional_sdk_frame:
                        return True
                    else:
                        return False
                else:
                    # Found a non-conditional SDK frame, this is definitely an SDK crash
                    return True

            if not self.is_system_library_frame(frame):
                return False

        return False

    def _matches_ignore_when_only_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        """
        Returns true if the frame matches the sdk_crash_ignore_when_only_sdk_frame_matchers pattern.
        """
        function = frame.get("function")
        if not function:
            return False

        module = frame.get("module")
        for matcher in self.config.sdk_crash_ignore_when_only_sdk_frame_matchers:
            function_matches = glob_match(function, matcher.function_pattern, ignorecase=True)
            module_matches = glob_match(module, matcher.module_pattern, ignorecase=True)

            if function_matches and module_matches:
                return True

        return False

    def is_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        """
        Returns true if frame is an SDK frame.

        :param frame: The frame of a stacktrace.
        """

        function = frame.get("function")
        if function:
            for (
                function_and_path_pattern
            ) in self.config.sdk_frame_config.function_and_path_patterns:
                function_pattern = function_and_path_pattern.function_pattern
                path_pattern = function_and_path_pattern.path_pattern

                function_matches = glob_match(function, function_pattern, ignorecase=True)
                path_matches = self._path_patters_match_frame({path_pattern}, frame)

                if function_matches and path_matches:
                    return True

            for patterns in self.config.sdk_frame_config.function_patterns:
                if glob_match(function, patterns, ignorecase=True):
                    return True

        return self._path_patters_match_frame(self.config.sdk_frame_config.path_patterns, frame)

    def is_system_library_frame(self, frame: Mapping[str, Any]) -> bool:
        return self._path_patters_match_frame(self.config.system_library_path_patterns, frame)

    def _path_patters_match_frame(self, path_patters: set[str], frame: Mapping[str, Any]) -> bool:
        for field in self.fields_containing_paths:
            for pattern in path_patters:
                field_with_path = frame.get(field)
                if field_with_path and glob_match(
                    field_with_path, pattern, ignorecase=True, doublestar=True, path_normalize=True
                ):
                    return True

        return False
