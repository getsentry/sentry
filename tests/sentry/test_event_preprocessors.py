from __future__ import annotations

from sentry.event_preprocessors import get_event_preprocessors
from sentry.lang.dart.utils import deobfuscate_exception_type
from sentry.lang.java.processing import deobfuscate_exception_value
from sentry.lang.javascript.preprocessing import preprocess_event
from sentry.testutils.cases import TestCase


class GetEventPreprocessorsTest(TestCase):
    def test_java_proguard_event(self) -> None:
        data = {
            "platform": "java",
            "debug_meta": {
                "images": [{"type": "proguard", "uuid": "1234-abcd"}],
            },
        }
        assert get_event_preprocessors(data) == [deobfuscate_exception_value]

    def test_javascript_event(self) -> None:
        data = {"platform": "javascript"}
        assert get_event_preprocessors(data) == [preprocess_event]

    def test_node_event(self) -> None:
        data = {"platform": "node"}
        assert get_event_preprocessors(data) == [preprocess_event]

    def test_dart_flutter_obfuscated_event(self) -> None:
        data = {
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter"},
            "debug_meta": {
                "images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}],
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error",
                        "stacktrace": {
                            "frames": [{"platform": "native"}],
                        },
                    }
                ]
            },
        }
        assert get_event_preprocessors(data) == [deobfuscate_exception_type]

    def test_dart_sdk_obfuscated_event(self) -> None:
        data = {
            "platform": "dart",
            "sdk": {"name": "sentry.dart"},
            "debug_meta": {
                "images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}],
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error",
                        "stacktrace": {
                            "frames": [{"platform": "native"}],
                        },
                    }
                ]
            },
        }
        assert get_event_preprocessors(data) == [deobfuscate_exception_type]

    def test_dart_no_debug_images_returns_empty(self) -> None:
        data = {
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter"},
        }
        assert get_event_preprocessors(data) == []

    def test_dart_no_native_frames_returns_empty(self) -> None:
        data = {
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter"},
            "debug_meta": {
                "images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}],
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error",
                        "stacktrace": {
                            "frames": [{"platform": "dart"}],
                        },
                    }
                ]
            },
        }
        assert get_event_preprocessors(data) == []

    def test_dart_wrong_sdk_returns_empty(self) -> None:
        data = {
            "platform": "dart",
            "sdk": {"name": "sentry.python"},
            "debug_meta": {
                "images": [{"debug_id": "b8e43a-f242-3d73-a453-aeb6a777ef75"}],
            },
        }
        assert get_event_preprocessors(data) == []

    def test_python_event_returns_empty(self) -> None:
        data = {"platform": "python"}
        assert get_event_preprocessors(data) == []

    def test_transaction_returns_empty(self) -> None:
        data = {"platform": "python", "type": "transaction"}
        assert get_event_preprocessors(data) == []

    def test_mixed_proguard_and_js_returns_both(self) -> None:
        data = {
            "platform": "javascript",
            "debug_meta": {
                "images": [{"type": "proguard", "uuid": "1234-abcd"}],
            },
        }
        assert get_event_preprocessors(data) == [deobfuscate_exception_value, preprocess_event]
