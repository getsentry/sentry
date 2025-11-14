from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import int, Any

from sentry.lang.dart.utils import deobfuscate_exception_type, get_debug_meta_image_ids
from sentry.plugins.base.v2 import EventPreprocessor, Plugin2
from sentry.stacktraces.processing import find_stacktraces_in_data


class DartPlugin(Plugin2):
    """
    This plugin is responsible for Dart specific processing on events or attachments.
    """

    def can_configure_for_project(self, project, **kwargs) -> bool:
        return False

    def get_event_preprocessors(self, data: Mapping[str, Any]) -> Sequence[EventPreprocessor]:
        sdk_name = data.get("sdk", {}).get("name", "")
        if sdk_name not in ("sentry.dart", "sentry.dart.flutter"):
            return []

        debug_ids = get_debug_meta_image_ids(dict(data))
        if len(debug_ids) == 0:
            return []

        # Check if any stacktrace contains native platform frames.
        # This indicates that the Flutter build is most likely obfuscated.
        has_native_frames = _has_native_frames_in_stacktraces(data)
        if not has_native_frames:
            return []

        return [deobfuscate_exception_type]


def _has_native_frames_in_stacktraces(data):
    for stacktrace_info in find_stacktraces_in_data(data):
        frames = stacktrace_info.get_frames()
        if frames and any(frame.get("platform") == "native" for frame in frames):
            return True
    return False
