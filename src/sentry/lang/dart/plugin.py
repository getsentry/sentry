from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.lang.dart.utils import deobfuscate_exception_type, get_dart_symbols_images
from sentry.plugins.base.v2 import EventPreprocessor, Plugin2
from sentry.stacktraces.processing import find_stacktraces_in_data


class DartPlugin(Plugin2):
    """
    This plugin is responsible for Dart specific processing on events or attachments.
    """

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_event_preprocessors(self, data: Mapping[str, Any]) -> Sequence[EventPreprocessor]:
        sdk_name = data.get("sdk", {}).get("name", "")
        if sdk_name not in ("sentry.dart", "sentry.dart.flutter"):
            return []

        debug_ids = get_dart_symbols_images(data)
        if len(debug_ids) == 0:
            return []

        # Check if any stacktrace contains native platform frames.
        # This indicates that the Flutter build is most likely obfuscated.
        has_native_frames = False
        for stacktrace_info in find_stacktraces_in_data(data):
            frames = stacktrace_info.get_frames()
            if frames:
                for frame in frames:
                    if frame.get("platform") == "native":
                        has_native_frames = True
                        break

        if not has_native_frames:
            return []

        return [deobfuscate_exception_type]
