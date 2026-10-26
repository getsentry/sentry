from collections.abc import Mapping, Sequence
from typing import Any

from packaging.version import InvalidVersion, Version

from sentry.db.models import NodeData
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detection_config import (
    FunctionAndModulePattern,
    FunctionAndPathPattern,
    SDKCrashDetectionConfig,
    StacktraceIgnoreMatcher,
)


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

        # For efficiency, we first check if an SDK frame appears before any non-system frame
        # (Loop 1). Most crashes are not SDK crashes, so we avoid the overhead of the ignore
        # checks in the common case. Only if we detect a potential SDK crash do we run the
        # additional validation loops (Loop 2 and Loop 3).

        # Loop 1: Check if the first non-system frame (closest to crash origin) is an SDK frame.
        potential_sdk_crash = False
        for frame in iter_frames:
            if self.is_sdk_frame(frame):
                potential_sdk_crash = True
                break

            if not self.is_system_library_frame(frame):
                # A non-SDK, non-system frame (e.g., app code) appeared first.
                return False

        if not potential_sdk_crash:
            return False

        # Loop 1.5: Check if the full stacktrace matches an ignore group. Unlike
        # sdk_crash_ignore_matchers (Loop 2), which only inspects frames up to the first SDK
        # frame, these matchers inspect the entire stacktrace and only ignore the crash when
        # *every* pattern in a group matches some frame (and, when the group requires it, its last
        # pattern is directly followed by an SDK frame). This lets us ignore crashes that can only
        # be identified by a combination of frames, e.g. SDK setup being re-run by the React
        # Native dev server (Metro) on hot reload, where it is dispatched through the device event
        # emitter and the WebSocket module directly into SDK code — never a production path.
        if self._matches_sdk_crash_ignore_stacktrace(iter_frames):
            return False

        # Loop 2: Check if any frame (up to the first SDK frame) matches sdk_crash_ignore_matchers.
        # These are SDK methods used for testing (e.g., +[SentrySDK crash]) that intentionally
        # trigger crashes and should not be reported as SDK crashes. We only check frames up to
        # the first SDK frame to match the original single-loop algorithm behavior.
        for frame in iter_frames:
            if self._matches_sdk_crash_ignore(frame):
                return False
            if self.is_sdk_frame(frame):
                # Stop at the first SDK frame; don't check older frames in the call stack.
                break

        # Loop 3: Check if the only SDK frame is a "conditional" one (e.g., SentrySwizzleWrapper).
        # These are SDK instrumentation frames that intercept calls but are unlikely to cause
        # crashes themselves. When every SDK frame in the stack is conditional (e.g. swizzle
        # wrappers), the crash is suppressed — regardless of how many conditional frames appear.
        # The same instrumentation frame can appear multiple times (e.g. UIKit calling
        # sendAction: twice in the responder chain), and that still isn't an SDK bug.
        has_conditional_sdk_frame = False
        has_non_conditional_sdk_frame = False
        for frame in iter_frames:
            if self.is_sdk_frame(frame):
                if self._matches_sdk_crash_ignore(frame):
                    continue
                if self._matches_ignore_when_only_sdk_frame(frame):
                    has_conditional_sdk_frame = True
                else:
                    has_non_conditional_sdk_frame = True
                    break

        if has_conditional_sdk_frame and not has_non_conditional_sdk_frame:
            return False

        # Passed all ignore checks: this is an SDK crash.
        return True

    def _matches_ignore_when_only_sdk_frame(self, frame: Mapping[str, Any]) -> bool:
        return self._matches_frame_pattern(
            frame, self.config.sdk_crash_ignore_when_only_sdk_frame_matchers
        )

    def _matches_sdk_crash_ignore(self, frame: Mapping[str, Any]) -> bool:
        return self._matches_frame_pattern(frame, self.config.sdk_crash_ignore_matchers)

    def _matches_sdk_crash_ignore_stacktrace(self, frames: Sequence[Mapping[str, Any]]) -> bool:
        for matcher in self.config.sdk_crash_ignore_stacktrace_matchers:
            if self._matches_stacktrace_ignore(frames, matcher):
                return True
        return False

    def _matches_stacktrace_ignore(
        self, frames: Sequence[Mapping[str, Any]], matcher: StacktraceIgnoreMatcher
    ) -> bool:
        if not all(
            any(self._matches_function_and_path(frame, pattern) for frame in frames)
            for pattern in matcher.patterns
        ):
            return False

        if not matcher.require_sdk_frame_after:
            return True

        # Require that a frame matching the last pattern is directly followed by an SDK frame
        # (its callee). `frames` is ordered newest (callee) to oldest (caller), so the callee of
        # frames[i] is frames[i - 1]. This distinguishes a caller that dispatches straight into
        # SDK code (e.g. the React Native dev server re-evaluating an SDK module) from a
        # production caller chain that passes through the same frame before reaching app code.
        anchor = matcher.patterns[-1]
        return any(
            i > 0
            and self._matches_function_and_path(frame, anchor)
            and self.is_sdk_frame(frames[i - 1])
            for i, frame in enumerate(frames)
        )

    def _matches_function_and_path(
        self, frame: Mapping[str, Any], pattern: FunctionAndPathPattern
    ) -> bool:
        function = frame.get("function")
        if not function:
            return False

        if not glob_match(function, pattern.function_pattern, ignorecase=True):
            return False

        # Match the path pattern against the frame's path-bearing fields (filename, abs_path,
        # etc.). React Native JS frames carry the module path there rather than in `module`.
        return self._path_patters_match_frame({pattern.path_pattern}, frame)

    def _matches_frame_pattern(
        self, frame: Mapping[str, Any], matchers: set[FunctionAndModulePattern]
    ) -> bool:
        function = frame.get("function")
        if not function:
            return False

        module = frame.get("module")
        for matcher in matchers:
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
