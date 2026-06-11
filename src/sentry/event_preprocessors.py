from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.lang.dart.utils import (
    get_debug_meta_image_ids,
    has_native_frames_in_stacktraces,
)
from sentry.lang.java.utils import has_proguard_file
from sentry.plugins.base.v2 import EventPreprocessor


def get_event_preprocessor(data: Mapping[str, Any]) -> EventPreprocessor | None:
    """Return the single preprocessor needed for this event, or None."""
    from sentry.lang.dart.utils import deobfuscate_exception_type
    from sentry.lang.java.processing import deobfuscate_exception_value
    from sentry.lang.javascript.preprocessing import preprocess_event

    if has_proguard_file(data):
        return deobfuscate_exception_value
    elif data.get("platform") in ("javascript", "node"):
        return preprocess_event
    elif _is_obfuscated_dart_event(data):
        return deobfuscate_exception_type
    return None


def _is_obfuscated_dart_event(data: Mapping[str, Any]) -> bool:
    sdk_name = (data.get("sdk") or {}).get("name", "")
    if sdk_name not in ("sentry.dart", "sentry.dart.flutter"):
        return False
    if not get_debug_meta_image_ids(dict(data)):
        return False
    return has_native_frames_in_stacktraces(data)
