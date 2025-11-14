from __future__ import annotations
from typing import int

from sentry.lang.dart.plugin import DartPlugin
from sentry.testutils.cases import TestCase


class DartPluginTest(TestCase):
    def setUp(self) -> None:
        self.plugin = DartPlugin()
        self.data = {
            "project": self.project.id,
            "sdk": {"name": "sentry.dart.flutter"},
            "debug_meta": {"images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}]},
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error: something bad happened with xyz",
                    }
                ]
            },
            "stacktrace": {
                "frames": [
                    {
                        "abs_path": "package:myapp/main.dart",
                        "filename": "main.dart",
                        "platform": "native",
                    }
                ]
            },
        }

    def test_can_configure_for_project(self) -> None:
        """Test that the plugin cannot be configured for projects."""
        assert not self.plugin.can_configure_for_project(self.project)

    def test_get_event_preprocessors_no_dart_sdk(self) -> None:
        """Test that no preprocessors are returned for non-Dart SDKs."""
        data = {**self.data, "sdk": {"name": "sentry.python"}}
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 0

    def test_get_event_preprocessors_no_debug_images(self) -> None:
        """Test that no preprocessors are returned when there are no debug images."""
        data = {**self.data}
        del data["debug_meta"]
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 0

    def test_get_event_preprocessors_no_native_frames(self) -> None:
        """Test that no preprocessors are returned when there are no native frames."""
        # Remove native platform from frames
        data = {**self.data}
        data["stacktrace"]["frames"][0]["platform"] = "dart"
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 0

    def test_get_event_preprocessors_with_dart_flutter_native_frames(self) -> None:
        """Test that deobfuscate_exception_type is returned for Dart/Flutter events with native frames."""
        # Add native frames to trigger deobfuscation
        data = {
            "project": self.project.id,
            "sdk": {"name": "sentry.dart.flutter"},
            "debug_meta": {"images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}]},
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error: something bad happened",
                        "stacktrace": {
                            "frames": [
                                {
                                    "abs_path": "package:myapp/main.dart",
                                    "filename": "main.dart",
                                    "platform": "native",  # This is what triggers deobfuscation
                                }
                            ]
                        },
                    }
                ]
            },
        }
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1
        # Verify the preprocessor is deobfuscate_exception_type
        from sentry.lang.dart.utils import deobfuscate_exception_type

        assert preprocessors[0] == deobfuscate_exception_type

    def test_get_event_preprocessors_dart_sdk(self) -> None:
        """Test that preprocessors work for sentry.dart SDK (not just flutter)."""
        data = {
            **self.data,
            "sdk": {"name": "sentry.dart"},
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    }
                ]
            },
        }
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1

    def test_get_event_preprocessors_multiple_stacktraces(self) -> None:
        """Test that preprocessors are returned when native frames exist in any stacktrace."""
        data = {
            "project": self.project.id,
            "sdk": {"name": "sentry.dart.flutter"},
            "debug_meta": {"images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}]},
            "stacktrace": {
                "frames": [
                    {"platform": "dart"},  # Non-native frame
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error",
                        "stacktrace": {
                            "frames": [
                                {"platform": "dart"},  # Non-native frame
                            ]
                        },
                    },
                    {
                        "type": "abc",
                        "value": "Another error",
                        "stacktrace": {
                            "frames": [
                                {"platform": "native"},  # Native frame - should trigger
                            ]
                        },
                    },
                ]
            },
        }
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1
