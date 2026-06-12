from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.lang.dart.utils import (
    get_debug_meta_image_ids,
    has_native_frames_in_stacktraces,
)
from sentry.lang.java.utils import has_proguard_file
from sentry.plugins.base.v2 import EventPreprocessor


def get_event_preprocessors(data: Mapping[str, Any]) -> list[EventPreprocessor]:
    """Return all preprocessors needed for this event."""
    from sentry.lang.dart.utils import deobfuscate_exception_type
    from sentry.lang.java.processing import deobfuscate_exception_value
    from sentry.lang.javascript.preprocessing import preprocess_event

    preprocessors: list[EventPreprocessor] = []
    if has_proguard_file(data):
        preprocessors.append(deobfuscate_exception_value)
    if data.get("platform") in ("javascript", "node"):
        preprocessors.append(preprocess_event)
    if _is_obfuscated_dart_event(data):
        preprocessors.append(deobfuscate_exception_type)
    return preprocessors


def _is_obfuscated_dart_event(data: Mapping[str, Any]) -> bool:
    sdk_name = (data.get("sdk") or {}).get("name", "")
    if sdk_name not in ("sentry.dart", "sentry.dart.flutter"):
        return False
    if not get_debug_meta_image_ids(dict(data)):
        return False
    return has_native_frames_in_stacktraces(data)
