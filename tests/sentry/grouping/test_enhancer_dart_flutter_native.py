"""
Tests for Dart/Flutter enhancement rules on the *native* platform.
"""

from __future__ import annotations

from sentry.grouping.enhancer import ENHANCEMENT_BASES
from sentry.testutils.cases import TestCase
from sentry.testutils.fixtures import Fixtures


class _BaseNativeDartFlutterEnhancerTest(TestCase, Fixtures):
    """Common setup and helpers shared by native-platform tests."""

    PLATFORM = "native"

    def setUp(self):
        super().setUp()
        # Load the default enhancement rules that include Dart/Flutter logic.
        self.enhancements = ENHANCEMENT_BASES["newstyle:2023-01-11"]

    def apply_rules(self, frame: dict[str, str]):
        """Apply enhancement rules to a single frame and return the processed frame."""
        frames = [frame]
        self.enhancements.apply_category_and_updated_in_app_to_frames(frames, self.PLATFORM, {})
        return frames[0]


class TestDartFlutterEnhancerNative(_BaseNativeDartFlutterEnhancerTest):
    """Tests that are expected to run with platform="native" only."""

    # ---------------------------------------------------------------------
    # Android application frames
    # ---------------------------------------------------------------------

    def test_dart_android_app_files_are_in_app(self):
        """Dart files shipped in an Android APK of the app should be in-app."""
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "package:myapp/main.dart",
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is True

        # Different APK path + deeper Dart file structure
        frame = {
            "package": "/data/app/com.example.flutter-2/split_config.arm64_v8a.apk",
            "abs_path": "package:myapp/src/widgets/home_screen.dart",
        }
        result = self.apply_rules(frame)
        assert result["in_app"] is True

        # Must satisfy both conditions (package path + *.dart)
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "some_other_file.txt",
        }
        result = self.apply_rules(frame)
        assert result.get("in_app") is None

    # ------------------------------------------------------------------
    # Flutter framework & engine
    # ------------------------------------------------------------------

    def test_flutter_packages_not_in_app(self):
        """Flutter framework sources should be out-of-app on the native platform."""
        frame = {"abs_path": "/Users/dev/project/packages/flutter/lib/src/material/app.dart"}
        result = self.apply_rules(frame)
        assert result["in_app"] is False

        # Flutter engine SDK specific paths
        for engine_path in ("lib/ui/hooks.dart", "lib/ui/platform_dispatcher.dart"):
            frame = {"abs_path": engine_path}
            result = self.apply_rules(frame)
            assert result["in_app"] is False

        # Misc additional flutter-package paths
        flutter_paths = [
            "packages/flutter/lib/material.dart",
            "/home/user/.pub-cache/hosted/pub.dev/flutter-3.0.0/lib/widgets.dart",
            "file:///Users/dev/packages/flutter/src/foundation/binding.dart",
        ]
        for path in flutter_paths:
            frame = {"abs_path": path}
            result = self.apply_rules(frame)
            assert result["in_app"] is False, f"Path {path} should be out-of-app"

    # ------------------------------------------------------------------
    # Sentry Dart SDK
    # ------------------------------------------------------------------

    def test_sentry_dart_packages_not_in_app(self):
        """All Sentry Dart SDK packages should always be out-of-app."""
        sentry_packages = [
            "package:sentry/sentry.dart",
            "package:sentry/src/hub.dart",
            "package:sentry_flutter/sentry_flutter.dart",
            "package:sentry_flutter/src/native_bridge.dart",
        ]
        integration_packages = [
            "package:sentry_logging/sentry_logging.dart",
            "package:sentry_dio/src/dio_event_processor.dart",
            "package:sentry_file/sentry_file.dart",
            "package:sentry_hive/src/sentry_hive_impl.dart",
            "package:sentry_isar/sentry_isar.dart",
            "package:sentry_sqflite/src/sentry_database.dart",
            "package:sentry_drift/sentry_drift.dart",
            "package:sentry_link/sentry_link.dart",
            "package:sentry_firebase_remote_config/sentry_firebase_remote_config.dart",
        ]
        for path in sentry_packages + integration_packages:
            frame = {"abs_path": path}
            result = self.apply_rules(frame)
            assert result["in_app"] is False, f"Sentry package {path} should be out-of-app"

    # ------------------------------------------------------------------
    # pub-cache packages
    # ------------------------------------------------------------------

    def test_pub_cache_not_in_app(self):
        """Third-party packages coming from the pub-cache are out-of-app."""
        pub_cache_paths = [
            "/Users/dev/.pub-cache/hosted/pub.dev/http-0.13.5/lib/http.dart",
            "/home/user/.pub-cache/git/some_package-abc123/lib/main.dart",
            "C:\\Users\\Dev\\.pub-cache\\hosted\\pub.dev\\provider-6.0.0\\lib\\provider.dart",
            "/opt/flutter/.pub-cache/hosted/pub.dartlang.org/dio-4.0.0/lib/dio.dart",
        ]
        for path in pub_cache_paths:
            frame = {"abs_path": path}
            result = self.apply_rules(frame)
            assert result["in_app"] is False, f"pub-cache path {path} should be out-of-app"

    # ------------------------------------------------------------------
    # User code – default behaviour
    # ------------------------------------------------------------------

    def test_user_dart_files_default_behavior(self):
        """User Dart files that do not match any rule should keep their original in_app status."""
        frames = [
            {"abs_path": "lib/main.dart"},
            {"abs_path": "package:myapp/src/utils/helper.dart"},
            {"abs_path": "file:///home/user/projects/myapp/lib/models/user.dart"},
        ]
        for frame in frames:
            result = self.apply_rules(frame)
            assert result.get("in_app") is None, f"{frame['abs_path']} should be untouched"

    # ------------------------------------------------------------------
    # Rules specific to *other* platforms should not fire
    # ------------------------------------------------------------------

    def test_javascript_specific_rule_does_not_apply_on_native(self):
        """Rules that are only defined for the JavaScript family must not affect native frames."""
        frames = [
            {"module": "packages/flutter/src/widgets/container.dart"},
            {"abs_path": "org-dartlang-sdk:///sdk/lib/core/object.dart"},
        ]
        for frame in frames:
            result = self.apply_rules(frame)
            assert result.get("in_app") is None, f"{frame['abs_path']} should be untouched"

    # ------------------------------------------------------------------
    # Misc / edge-cases
    # ------------------------------------------------------------------

    def test_edge_cases(self):
        """Cover miscellaneous edge-cases for native frames."""
        # Android rule – requires *.dart extension
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "package:myapp/main",  # Missing .dart
        }
        result = self.apply_rules(frame)
        assert result.get("in_app") is None
