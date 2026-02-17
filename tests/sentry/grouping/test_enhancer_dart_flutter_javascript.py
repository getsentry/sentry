"""
Tests for Dart/Flutter enhancement rules on the *javascript* platform (a.k.a. the "browser"/"dart2js" output
executed in a JavaScript runtime).
"""

from __future__ import annotations

from typing import Any

from sentry.grouping.enhancer import ENHANCEMENT_BASES

PLATFORM = "javascript"
ENHANCEMENTS = ENHANCEMENT_BASES["all-platforms:2023-01-11"]


def _apply_rules(frame: dict[str, str]) -> dict[str, Any]:
    frames = [frame]
    ENHANCEMENTS.apply_category_and_updated_in_app_to_frames(frames, PLATFORM, {})
    return frames[0]


# ------------------------------------------------------------------
# Dart SDK
# ------------------------------------------------------------------


def test_dart_sdk_not_in_app() -> None:
    """All frames coming from the Dart SDK must be out-of-app."""
    sdk_paths = [
        "org-dartlang-sdk:///sdk/lib/core/object.dart",
        "org-dartlang-sdk:///sdk/lib/async/future.dart",
        "org-dartlang-sdk:///sdk/lib/collection/list.dart",
        "org-dartlang-sdk:///flutter/lib/ui/window.dart",
    ]
    for path in sdk_paths:
        frame = {"abs_path": path}
        result = _apply_rules(frame)
        assert result["in_app"] is False


# ------------------------------------------------------------------
# Flutter framework (compiled to JS)
# ------------------------------------------------------------------


def test_flutter_packages_not_in_app() -> None:
    """Flutter framework modules compiled to JS (dart2js) are out-of-app."""
    frame = {"module": "packages/flutter/src/widgets/framework.dart"}
    result = _apply_rules(frame)
    assert result["in_app"] is False

    # Another example module
    frame = {"module": "packages/flutter/src/widgets/container.dart"}
    result = _apply_rules(frame)
    assert result["in_app"] is False


# ------------------------------------------------------------------
# Ensure native-specific rules do not leak into JS
# ------------------------------------------------------------------


def test_android_app_rule_does_not_apply_on_javascript() -> None:
    """The APK rule is native-specific and must not affect JS frames."""
    frame = {
        "package": "/data/app/com.example.myapp-1/base.apk",
        "abs_path": "package:myapp/main.dart",
    }
    result = _apply_rules(frame)
    # The JS family definitions have no such rule → in_app should be untouched
    assert result.get("in_app") is None, f"{frame['abs_path']} should be untouched"
