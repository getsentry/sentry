"""
Tests for Dart/Flutter enhancement rules on the *javascript* platform (a.k.a. the "browser"/"dart2js" output
executed in a JavaScript runtime).
"""

from __future__ import annotations

from typing import Any

from sentry.grouping.enhancer import ENHANCEMENT_BASES
from sentry.testutils.cases import TestCase


class _BaseJavaScriptDartFlutterEnhancerTest(TestCase):
    PLATFORM = "javascript"

    def setUp(self) -> None:
        super().setUp()
        self.enhancements = ENHANCEMENT_BASES["all-platforms:2026-01-20"]

    def apply_rules(self, frame: dict[str, Any]) -> dict[str, Any]:
        frames = [frame]
        self.enhancements.apply_category_and_updated_in_app_to_frames(frames, self.PLATFORM, {})
        return frames[0]


class TestDartFlutterEnhancerJavaScript(_BaseJavaScriptDartFlutterEnhancerTest):
    """Tests that are expected to run with platform="javascript" only."""

    # ------------------------------------------------------------------
    # Dart SDK
    # ------------------------------------------------------------------

    def test_dart_sdk_not_in_app(self) -> None:
        """All frames coming from the Dart SDK must be out-of-app."""
        sdk_paths = [
            "org-dartlang-sdk:///sdk/lib/core/object.dart",
            "org-dartlang-sdk:///sdk/lib/async/future.dart",
            "org-dartlang-sdk:///sdk/lib/collection/list.dart",
            "org-dartlang-sdk:///flutter/lib/ui/window.dart",
        ]
        for path in sdk_paths:
            frame = {"abs_path": path}
            result = self.apply_rules(frame)
            assert result["in_app"] is False

    # ------------------------------------------------------------------
    # Flutter framework (compiled to JS)
    # ------------------------------------------------------------------

    def test_flutter_packages_not_in_app(self) -> None:
        """Flutter framework modules compiled to JS (dart2js) are out-of-app."""
        frame = {"module": "packages/flutter/src/widgets/framework.dart"}
        result = self.apply_rules(frame)
        assert result["in_app"] is False

        # Another example module
        frame = {"module": "packages/flutter/src/widgets/container.dart"}
        result = self.apply_rules(frame)
        assert result["in_app"] is False

    # ------------------------------------------------------------------
    # pub-cache packages (Flutter web / dart2js source maps)
    # ------------------------------------------------------------------

    def test_pub_cache_not_in_app(self) -> None:
        """Third-party packages coming from the pub-cache are out-of-app on JS.

        Flutter web (dart2js) source maps emit relative `.pub-cache` paths. The
        SDK currently marks those frames in-app; the enhancer must override.
        """
        frame = {
            "abs_path": (
                "../../../../../../.pub-cache/hosted/pub.dev/"
                "desktop_drop-0.5.0/lib/desktop_drop_web.dart"
            ),
            "function": "DesktopDropWeb._registerEvents.<anonymous function>.<anonymous function>",
            "lineno": 92,
            "in_app": True,
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is False

        frame = {
            "abs_path": (
                "../../../../../../.pub-cache/hosted/pub.dev/"
                "desktop_drop-0.5.0/lib/desktop_drop_web.dart"
            ),
            "function": "DesktopDropWeb._registerEvents.<anonymous function>",
            "lineno": 90,
            "in_app": True,
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is False

        frame = {
            "abs_path": "/Users/dev/.pub-cache/hosted/pub.dev/http-0.13.5/lib/http.dart",
            "in_app": True,
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is False

        frame = {
            "abs_path": "/home/user/.pub-cache/git/some_package-abc123/lib/main.dart",
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is False

    def test_user_javascript_frames_stay_in_app(self) -> None:
        """App frames that are not from pub-cache must remain in-app."""
        frame = {"abs_path": "/main.dart.js", "in_app": True}
        result = self.apply_rules(frame)
        assert result["in_app"] is True

        frame = {"abs_path": "packages/myapp/lib/main.dart", "in_app": True}
        result = self.apply_rules(frame)
        assert result["in_app"] is True

    # ------------------------------------------------------------------
    # Ensure native-specific rules do not leak into JS
    # ------------------------------------------------------------------

    def test_android_app_rule_does_not_apply_on_javascript(self) -> None:
        """The APK rule is native-specific and must not affect JS frames."""
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "package:myapp/main.dart",
        }
        result = self.apply_rules(frame)
        # The JS family definitions have no such rule → in_app should be untouched
        assert result.get("in_app") is None, f"{frame['abs_path']} should be untouched"
