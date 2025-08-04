from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.lang.dart.utils import deobfuscate_exception_type

# from sentry.models.project import Project
from sentry.plugins.base.v2 import EventPreprocessor, Plugin2
from sentry.stacktraces.processing import find_stacktraces_in_data

# from sentry.utils.options import sample_modulo


class DartPlugin(Plugin2):
    """
    This plugin is responsible for Dart specific processing on events or attachments.
    """

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_event_preprocessors(self, data: Mapping[str, Any]) -> Sequence[EventPreprocessor]:
        # Only process events from Dart/Flutter SDKs
        sdk_name = data.get("sdk", {}).get("name", "")
        if sdk_name not in ("sentry.dart", "sentry.dart.flutter"):
            return []

        # Check if any stacktrace contains native platform frames.
        # This indicates that the Flutter build is most likely obfuscated
        for stacktrace_info in find_stacktraces_in_data(data):
            frames = stacktrace_info.get_frames()
            if frames:
                for frame in frames:
                    if frame.get("platform") == "native":
                        has_native_frames = True
                        break
            if has_native_frames:
                break

        if not has_native_frames:
            return []

        # project = Project.objects.get_from_cache(id=data["project"])
        return [deobfuscate_exception_type]
        # if not sample_modulo(
        #     "processing.view-hierarchies-dart-deobfuscation", project.organization.id
        # ):
        #     return []

        # if has_dart_symbols_file(data):
        #     return [deobfuscate_view_hierarchy]
        # else:
        #     return []
