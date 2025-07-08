"""
Test cases for Dart/Flutter specific enhancement rules.
Tests how Dart and Flutter stack frames are processed through enhancement rules
and whether they are correctly marked as in-app or not in-app.
"""
from __future__ import annotations

from sentry.grouping.enhancer import ENHANCEMENT_BASES
from sentry.testutils.cases import TestCase
from sentry.testutils.fixtures import Fixtures


class TestDartFlutterEnhancerRules(TestCase, Fixtures):
    """Test that Dart/Flutter enhancement rules correctly set in_app status"""

    def setUp(self):
        super().setUp()
        # Load the default enhancement rules containing Dart/Flutter rules
        self.enhancements = ENHANCEMENT_BASES["newstyle:2023-01-11"]

    def apply_rules_to_frame(self, frame, platform="native"):
        """Helper to apply enhancement rules to a single frame"""
        frames = [frame]
        self.enhancements.apply_category_and_updated_in_app_to_frames(frames, platform, {})
        return frames[0]

    def test_dart_android_app_files_are_in_app(self):
        """Test that Dart files in Android apps are marked as in-app"""
        # This rule: family:native stack.package:/data/app/** stack.abs_path:**/*.dart +app
        # Requires both package and abs_path conditions to match
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "package:myapp/main.dart",
        }
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result["in_app"] is True

        # Test with different Android app paths
        frame = {
            "package": "/data/app/com.example.flutter-2/split_config.arm64_v8a.apk",
            "abs_path": "package:myapp/src/widgets/home_screen.dart",
        }
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result["in_app"] is True

        # Test that it requires both conditions
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "some_other_file.txt",  # Not a .dart file
        }
        result = self.apply_rules_to_frame(frame, platform="native")
        # Should not be marked as in-app because abs_path doesn't end with .dart
        assert result.get("in_app") is None

    def test_dart_sdk_not_in_app(self):
        """Test that Dart SDK files are not marked as in-app"""
        # Rule: family:javascript stack.abs_path:org-dartlang-sdk:///** -app -group
        frame = {
            "abs_path": "org-dartlang-sdk:///sdk/lib/core/object.dart"
        }
        result = self.apply_rules_to_frame(frame, platform="javascript")
        assert result["in_app"] is False

        # Test various SDK paths
        sdk_paths = [
            "org-dartlang-sdk:///sdk/lib/async/future.dart",
            "org-dartlang-sdk:///sdk/lib/collection/list.dart",
            "org-dartlang-sdk:///flutter/lib/ui/window.dart",
        ]

        for path in sdk_paths:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame, platform="javascript")
            assert result["in_app"] is False, f"SDK path {path} should not be in-app"

    def test_flutter_packages_not_in_app(self):
        """Test that Flutter framework packages are not marked as in-app"""
        # JavaScript platform rule: family:javascript module:**/packages/flutter/** -app
        frame = {
            "module": "packages/flutter/src/widgets/framework.dart"
        }
        result = self.apply_rules_to_frame(frame, platform="javascript")
        assert result["in_app"] is False

        # Native platform rule: family:native stack.abs_path:**/packages/flutter/** -app
        frame = {
            "abs_path": "/Users/dev/project/packages/flutter/lib/src/material/app.dart"
        }
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result["in_app"] is False

        # Test various Flutter package paths
        flutter_paths = [
            "packages/flutter/lib/material.dart",
            "/home/user/.pub-cache/hosted/pub.dev/flutter-3.0.0/lib/widgets.dart",
            "file:///Users/dev/packages/flutter/src/foundation/binding.dart",
        ]

        for path in flutter_paths:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame, platform="native")
            assert result["in_app"] is False, f"Flutter path {path} should not be in-app"

    def test_sentry_dart_packages_not_in_app(self):
        """Test that Sentry Dart SDK packages are not marked as in-app"""
        # Main Sentry packages
        sentry_packages = [
            "package:sentry/sentry.dart",
            "package:sentry/src/hub.dart",
            "package:sentry_flutter/sentry_flutter.dart",
            "package:sentry_flutter/src/native_bridge.dart",
        ]

        for path in sentry_packages:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Sentry package {path} should not be in-app"

        # Additional Sentry integration packages
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

        for path in integration_packages:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Sentry integration {path} should not be in-app"

    def test_pub_cache_not_in_app(self):
        """Test that packages from .pub-cache are not marked as in-app"""
        # Rule: family:native stack.abs_path:**/.pub-cache/** -app
        pub_cache_paths = [
            "/Users/dev/.pub-cache/hosted/pub.dev/http-0.13.5/lib/http.dart",
            "/home/user/.pub-cache/git/some_package-abc123/lib/main.dart",
            "C:\\Users\\Dev\\.pub-cache\\hosted\\pub.dev\\provider-6.0.0\\lib\\provider.dart",
            "/opt/flutter/.pub-cache/hosted/pub.dartlang.org/dio-4.0.0/lib/dio.dart",
        ]

        for path in pub_cache_paths:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame, platform="native")
            assert result["in_app"] is False, f".pub-cache path {path} should not be in-app"

    def test_user_dart_files_default_behavior(self):
        """Test that user Dart files that don't match specific rules retain default behavior"""
        # These should not match any Dart-specific rules and retain their default in_app status
        user_files = [
            {"abs_path": "lib/main.dart"},  # Relative path
            {"abs_path": "package:myapp/src/utils/helper.dart"},  # User package
            {"abs_path": "file:///home/user/projects/myapp/lib/models/user.dart"},  # Absolute path
        ]

        for frame in user_files:
            result = self.apply_rules_to_frame(frame)
            # These frames don't match any -app rules, so in_app should be None (unchanged)
            assert result.get("in_app") is None, f"User file {frame['abs_path']} should not be modified"

    def test_platform_specific_rules(self):
        """Test that platform-specific rules only apply to the correct platform"""
        # JavaScript-specific Flutter rule
        frame = {
            "module": "packages/flutter/src/widgets/container.dart"
        }

        # Should be marked as not in-app for JavaScript platform
        result = self.apply_rules_to_frame(frame, platform="javascript")
        assert result["in_app"] is False

        # Should not be affected for native platform (uses abs_path, not module)
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result.get("in_app") is None

    def test_complex_dart_stacktrace_scenario(self):
        """Test a realistic scenario with multiple Dart/Flutter frames"""
        # Simulate a typical Flutter error stacktrace
        frames = [
            # User app code - should be in-app on Android
            {
                "package": "/data/app/com.example.myapp-1/base.apk",
                "abs_path": "package:myapp/screens/login_screen.dart",
            },
            # Flutter framework - should not be in-app
            {"abs_path": "package:flutter/src/widgets/framework.dart"},
            # Dart SDK - should not be in-app
            {"abs_path": "org-dartlang-sdk:///sdk/lib/async/zone.dart"},
            # Third-party package from pub cache - should not be in-app
            {"abs_path": "/Users/dev/.pub-cache/hosted/pub.dev/dio-4.0.0/lib/src/dio.dart"},
            # Sentry SDK - should not be in-app
            {"abs_path": "package:sentry_flutter/src/sentry_flutter.dart"},
        ]

        expected_results = [
            True,   # User app code
            False,  # Flutter framework
            False,  # Dart SDK
            False,  # pub cache
            False,  # Sentry SDK
        ]

        for i, (frame, expected) in enumerate(zip(frames, expected_results)):
            # Determine platform based on frame content
            platform = "javascript" if "org-dartlang-sdk" in frame.get("abs_path", "") else "native"
            result = self.apply_rules_to_frame(frame, platform)

            if expected is None:
                assert result.get("in_app") is None, f"Frame {i} should not be modified"
            else:
                assert result["in_app"] is expected, f"Frame {i} should be in_app={expected}"

    def test_edge_cases(self):
        """Test edge cases and special scenarios"""
        # Test empty/missing fields
        frame = {"abs_path": ""}
        result = self.apply_rules_to_frame(frame)
        assert result.get("in_app") is None

        # Test case sensitivity (rules should be case-sensitive)
        frame = {"abs_path": "package:SENTRY/sentry.dart"}  # Uppercase
        result = self.apply_rules_to_frame(frame)
        # Should not match the lowercase rule
        assert result.get("in_app") is None

        # Test partial matches that shouldn't trigger
        frame = {"abs_path": "my_sentry_wrapper/lib/wrapper.dart"}  # Contains "sentry" but not as package:sentry
        result = self.apply_rules_to_frame(frame)
        assert result.get("in_app") is None

        # Test that .dart extension is required for Android app rule
        frame = {
            "package": "/data/app/com.example.myapp-1/base.apk",
            "abs_path": "package:myapp/main",  # Missing .dart extension
        }
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result.get("in_app") is None
