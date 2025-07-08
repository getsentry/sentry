"""
Test cases for verifying how stack frames are processed through enhancement rules
and whether they are correctly marked as in-app or not in-app.
"""
from __future__ import annotations

import pytest

from sentry.grouping.enhancer import ENHANCEMENT_BASES, Enhancements
from sentry.testutils.cases import TestCase
from sentry.testutils.fixtures import Fixtures


class TestEnhancerInApp(TestCase, Fixtures):
    """Test that enhancement rules correctly set in_app status for various stack frames"""

    def setUp(self):
        super().setUp()
        # Load the default enhancement rules
        self.enhancements = ENHANCEMENT_BASES["newstyle:2023-01-11"]

    def apply_rules_to_frame(self, frame, platform="native"):
        """Helper to apply enhancement rules to a single frame"""
        frames = [frame]
        self.enhancements.apply_category_and_updated_in_app_to_frames(frames, platform, {})
        return frames[0]

    def test_ios_app_bundle_is_in_app(self):
        """iOS app bundles should be marked as in-app"""
        frame = {"package": "/var/containers/Bundle/Application/12345/MyApp.app/MyApp"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

        # Test private variant
        frame = {"package": "/private/var/containers/Bundle/Application/12345/MyApp.app/MyApp"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

    def test_ios_simulator_is_in_app(self):
        """iOS simulator apps should be marked as in-app"""
        frame = {"package": "/Users/dev/Library/Developer/CoreSimulator/Devices/123/MyApp.app/MyApp"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

        # Alternative path
        frame = {"package": "/Users/dev/Containers/Bundle/Application/123/MyApp.app/MyApp"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

    def test_macos_app_contents_is_in_app(self):
        """macOS app contents should be marked as in-app"""
        frame = {"package": "/Applications/MyApp.app/Contents/MacOS/MyApp"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

    def test_user_path_is_in_app(self):
        """Files in user directories should be marked as in-app"""
        frame = {"package": "/Users/john/Projects/myapp/main"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

    def test_system_libraries_not_in_app(self):
        """System libraries should not be marked as in-app"""
        # Test various system library paths
        system_paths = [
            "/lib/libc.so.6",
            "/usr/lib/libpthread.so",
            "/usr/local/lib/libcustom.so",
            "/usr/local/Cellar/python/3.9/lib/libpython3.9.dylib",
            "linux-gate.so.1",
        ]

        for path in system_paths:
            frame = {"package": path}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Path {path} should not be in-app"

    def test_rust_std_functions_not_in_app(self):
        """Rust standard library functions should not be marked as in-app"""
        rust_functions = [
            "std::panic::panic_any",
            "core::result::unwrap_failed",
            "alloc::vec::Vec<T>::push",
            "__rust_start_panic",
            "rust_begin_unwind",
        ]

        for func in rust_functions:
            frame = {"function": func}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Function {func} should not be in-app"

    def test_support_frameworks_not_in_app(self):
        """Support frameworks should not be marked as in-app"""
        frameworks = [
            "/System/Library/Frameworks/libswiftCore.dylib",
            "/Applications/MyApp.app/Frameworks/KSCrash.framework/KSCrash",
            "/Applications/MyApp.app/Frameworks/SentrySwift.framework/SentrySwift",
            "/Applications/MyApp.app/Frameworks/Sentry.framework/Sentry",
        ]

        for framework in frameworks:
            frame = {"package": framework}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Framework {framework} should not be in-app"

    def test_sentry_functions_not_in_app(self):
        """Sentry SDK functions should not be marked as in-app"""
        sentry_functions = [
            "kscm_signal_handler",
            "sentrycrashcm_handleException",
            "kscrash_reportUserException",
            "sentrycrash_beginHandlingCrash",
            "-[KSCrash reportUserException:reason:]",
            "-[RNSentry captureException:]",
            "+[SentryClient logEvent:]",
            "-[SentryCrashReporter crash]",
        ]

        for func in sentry_functions:
            frame = {"function": func}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Function {func} should not be in-app"

    def test_dart_flutter_in_app_rules(self):
        """Test Dart/Flutter specific in-app rules"""
        # Android Dart files should be in-app by default
        frame = {
            "package": "/data/app/com.example.app-1/base.apk",
            "abs_path": "package:myapp/main.dart",
        }
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is True

        # Flutter SDK files should not be in-app
        flutter_paths = [
            "org-dartlang-sdk:///flutter/lib/ui/window.dart",
            "package:flutter/src/widgets/framework.dart",
            "file:///Users/dev/.pub-cache/hosted/pub.dev/provider-6.0.0/lib/src/provider.dart",
        ]

        for path in flutter_paths:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame, platform="javascript")
            assert result["in_app"] is False, f"Path {path} should not be in-app"

        # Sentry Dart packages should not be in-app
        sentry_dart_packages = [
            "package:sentry/src/sentry.dart",
            "package:sentry_flutter/src/sentry_flutter.dart",
            "package:sentry_logging/sentry_logging.dart",
            "package:sentry_dio/sentry_dio.dart",
        ]

        for path in sentry_dart_packages:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Package {path} should not be in-app"

    def test_javascript_vendor_not_in_app(self):
        """JavaScript vendor/third-party code should not be marked as in-app"""
        vendor_paths = [
            "/app/vendor/jquery.js",
            "/src/node_modules/react/index.js",
            "/dist/site-packages/django/core/handlers.py",
            "/venv/dist-packages/flask/app.py",
        ]

        for path in vendor_paths:
            frame = {"abs_path": path}
            result = self.apply_rules_to_frame(frame, platform="javascript")
            assert result["in_app"] is False, f"Path {path} should not be in-app"

    def test_javascript_cdn_not_in_app(self):
        """JavaScript from CDNs should not be marked as in-app"""
        cdn_modules = [
            "unpkg/react@17.0.2/index.js",
            "https://unpkg.com/react@17.0.2/umd/react.production.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js",
            "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js",
            "https://esm.run/react",
        ]

        for module in cdn_modules:
            frame = {"module": module} if not module.startswith("http") else {"abs_path": module}
            result = self.apply_rules_to_frame(frame, platform="javascript")
            assert result["in_app"] is False, f"Module {module} should not be in-app"

    def test_transpiler_functions_not_in_app(self):
        """Transpiler and polyfill functions should not be marked as in-app"""
        # Test babel modules
        babel_modules = ["@babel/runtime/helpers/createClass", "core-js/modules/es.array.from"]
        for module in babel_modules:
            frame = {"module": module}
            result = self.apply_rules_to_frame(frame, platform="javascript")
            assert result["in_app"] is False, f"Module {module} should not be in-app"

        # Test specific functions
        frame = {"function": "_callSuper"}
        result = self.apply_rules_to_frame(frame, platform="javascript")
        assert result["in_app"] is False

    def test_go_pkg_mod_not_in_app(self):
        """Go package module files should not be marked as in-app"""
        frame = {"abs_path": "/Users/dev/go/pkg/mod/github.com/gin-gonic/gin@v1.7.0/gin.go"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is False

    def test_java_framework_modules_not_in_app(self):
        """Java framework modules should not be marked as in-app"""
        framework_modules = [
            "com.fasterxml.jackson.databind.ObjectMapper",
            "org.springframework.web.servlet.DispatcherServlet",
            "org.apache.tomcat.util.net.NioEndpoint",
            "io.sentry.Sentry",
            "javax.crypto.Cipher",
            "android.os.Handler",
        ]

        for module in framework_modules:
            frame = {"module": module}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Module {module} should not be in-app"

    def test_kotlin_modules_not_in_app(self):
        """Kotlin standard library modules should not be marked as in-app"""
        kotlin_modules = [
            "kotlin.collections.CollectionsKt",
            "kotlinx.coroutines.BuildersKt",
            "io.ktor.server.netty.NettyApplicationEngine",
        ]

        for module in kotlin_modules:
            frame = {"module": module}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Module {module} should not be in-app"

    def test_frame_categories(self):
        """Test that frames get assigned correct categories"""
        test_cases = [
            # System frames
            ({"package": "/System/Library/Frameworks/CoreFoundation"}, "system"),
            ({"package": "C:/Windows/System32/kernel32.dll"}, "system"),
            ({"function": "memset"}, "system"),
            ({"module": "dalvik.system.NativeStart"}, "system"),
            # Standard library
            ({"function": "std::vector::push_back"}, "std"),
            ({"module": "java.util.HashMap"}, "std"),
            # UI frameworks
            ({"package": "UIKit"}, "ui"),
            ({"module": "android.widget.TextView"}, "ui"),
            # Runtime
            ({"function": "art::jit::JitCompiler::CompileMethod"}, "runtime"),
            # Framework (Java)
            ({"module": "org.springframework.boot.SpringApplication"}, "framework"),
        ]

        for frame, expected_category in test_cases:
            result = self.apply_rules_to_frame(frame)
            actual_category = result.get("data", {}).get("category")
            assert actual_category == expected_category, (
                f"Frame {frame} should have category '{expected_category}' but got '{actual_category}'"
            )

    def test_in_app_state_tracking(self):
        """Test that original in_app state is tracked when changed"""
        # Frame with no initial in_app value
        frame = {"package": "/usr/lib/libc.so"}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is False
        assert result.get("data", {}).get("orig_in_app") == -1  # -1 means None

        # Frame with initial in_app=True that gets changed to False
        frame = {"package": "/usr/lib/libc.so", "in_app": True}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is False
        assert result.get("data", {}).get("orig_in_app") == 1  # 1 means True

        # Frame with initial in_app=False that stays False
        frame = {"package": "/usr/lib/libc.so", "in_app": False}
        result = self.apply_rules_to_frame(frame)
        assert result["in_app"] is False
        data = result.get("data", {})
        assert "orig_in_app" not in data  # No change, no tracking

    def test_unreal_engine_functions(self):
        """Test Unreal Engine specific rules"""
        # These functions have special rules with v+app -app ^-app
        ue_functions = [
            "FDebug::CheckVerifyFailedImpl",
            "UE::Assert::Private::ExecCheckImplInternal",
            "USentrySubsystem::CaptureMessage",
            "USentrySubsystem::CaptureEventWithScope",
        ]

        for func in ue_functions:
            frame = {"function": func}
            result = self.apply_rules_to_frame(frame)
            assert result["in_app"] is False, f"Function {func} should not be in-app"

    def test_custom_enhancements(self):
        """Test applying custom enhancement rules"""
        custom_rules = """
            package:com.mycompany.**                     +app
            function:myapp_*                             +app
            module:internal.*                            +app
            path:**/third_party/**                       -app
        """

        enhancements = Enhancements.from_rules_text(custom_rules)

        test_cases = [
            ({"package": "com.mycompany.app.MainActivity"}, True),
            ({"function": "myapp_init"}, True),
            ({"module": "internal.utils.Logger"}, True),
            ({"abs_path": "/app/third_party/lib/helper.py"}, False),
        ]

        for frame, expected_in_app in test_cases:
            frames = [frame]
            enhancements.apply_category_and_updated_in_app_to_frames(frames, "native", {})
            result = frames[0]
            assert result["in_app"] is expected_in_app, (
                f"Frame {frame} should be in_app={expected_in_app}"
            )

    def test_mixed_rules_application_order(self):
        """Test that rules are applied in order and later rules can override earlier ones"""
        # The default rules mark /Users/** as +app, but system libraries override this
        frame = {
            "package": "/Users/dev/homebrew/Cellar/python/3.9/Frameworks/Python.framework/Python",
            "function": "std::__1::vector<int>::push_back"
        }
        result = self.apply_rules_to_frame(frame)
        # Even though it's under /Users/, the std:: function should make it not in-app
        assert result["in_app"] is False

    def test_platform_specific_rules(self):
        """Test that platform-specific rules only apply to the correct platform"""
        # JavaScript-specific rule
        frame = {"function": "reportError"}

        # Should not be in-app for JavaScript
        result = self.apply_rules_to_frame(frame, platform="javascript")
        assert result["in_app"] is False

        # Should be None (unchanged) for other platforms
        frame = {"function": "reportError"}
        result = self.apply_rules_to_frame(frame, platform="native")
        assert result.get("in_app") is None

    @pytest.mark.parametrize(
        "frame,platform,expected_in_app",
        [
            # Quick parametrized tests for edge cases
            ({"package": ""}, "native", None),  # Empty package
            ({"function": ""}, "native", None),  # Empty function
            ({}, "native", None),  # Empty frame
            ({"package": "/var/containers/../../../etc/passwd"}, "native", None),  # Path traversal attempt
            ({"module": "com.android..*"}, "native", False),  # Android system module pattern
            ({"package": "/apex/com.android.runtime/lib64/libc.so"}, "native", False),  # APEX system libs
        ],
    )
    def test_edge_cases(self, frame, platform, expected_in_app):
        """Test edge cases and unusual inputs"""
        result = self.apply_rules_to_frame(frame, platform)
        if expected_in_app is None:
            assert result.get("in_app") is None
        else:
            assert result["in_app"] is expected_in_app
