from typing import int
"""Tests for Dart plugin deobfuscation functionality."""

from __future__ import annotations

from io import BytesIO

from sentry.lang.dart.plugin import DartPlugin
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.files.file import File
from sentry.testutils.cases import TestCase

# Example dart symbol map for testing
DART_SYMBOLS_UUID = "b8e43a-f242-3d73-a453-aeb6a777ef75"
DART_SYMBOLS_DATA = (
    b'["NetworkException", "xyz", "DatabaseException", "abc", "FileNotFoundException", "def"]'
)


class DartPluginDeobfuscationTest(TestCase):
    """Tests for Dart plugin exception deobfuscation functionality."""

    def setUp(self) -> None:
        super().setUp()
        self.plugin = DartPlugin()

    def upload_dart_symbols(
        self, debug_id: str = DART_SYMBOLS_UUID, data: bytes = DART_SYMBOLS_DATA
    ) -> None:
        """Helper to upload dart symbols file."""
        file = File.objects.create(
            name="dartsymbolmap.json",
            type="project.dif",
            headers={"Content-Type": "application/x-dartsymbolmap+json"},
        )
        file.putfile(BytesIO(data))

        ProjectDebugFile.objects.create(
            file=file,
            object_name="dartsymbolmap.json",
            cpu_name="any",
            project_id=self.project.id,
            debug_id=debug_id,
            code_id=None,
            data={"features": ["mapping"]},
        )

    def test_dart_exception_deobfuscation_direct(self) -> None:
        """Test that Dart exception types are deobfuscated by calling the preprocessor directly."""
        self.upload_dart_symbols()

        data = {
            "project": self.project.id,
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter", "version": "7.0.0"},
            "debug_meta": {
                "images": [
                    {
                        "debug_id": DART_SYMBOLS_UUID,
                    }
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Instance of 'xyz' was thrown",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "main.dart",
                                    "abs_path": "package:myapp/main.dart",
                                    "function": "doSomething",
                                    "lineno": 42,
                                    "colno": 12,
                                    "platform": "native",  # Native frames indicate obfuscation
                                }
                            ]
                        },
                    }
                ]
            },
        }

        # Get preprocessors
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1

        # Apply the preprocessor
        preprocessor = preprocessors[0]
        preprocessor(data)

        # Verify the exception type and value were deobfuscated
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        assert (
            data["exception"]["values"][0]["value"] == "Instance of 'NetworkException' was thrown"
        )

    def test_dart_multiple_exceptions_deobfuscation_direct(self) -> None:
        """Test that multiple Dart exceptions are deobfuscated."""
        self.upload_dart_symbols()

        data = {
            "project": self.project.id,
            "platform": "dart",
            "sdk": {"name": "sentry.dart", "version": "7.0.0"},
            "debug_meta": {
                "images": [
                    {
                        "debug_id": DART_SYMBOLS_UUID,
                    }
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "NetworkException: xyz",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    },
                    {
                        "type": "abc",
                        "value": "Database error: abc occurred",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    },
                    {
                        "type": "def",
                        "value": "File error: def not found",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    },
                ]
            },
        }

        # Get and apply preprocessor
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1
        preprocessors[0](data)

        # Verify all exception types were deobfuscated, values remain unchanged
        exception_values = data["exception"]["values"]
        assert exception_values[0]["type"] == "NetworkException"
        assert exception_values[0]["value"] == "NetworkException: xyz"
        assert exception_values[1]["type"] == "DatabaseException"
        assert exception_values[1]["value"] == "Database error: abc occurred"
        assert exception_values[2]["type"] == "FileNotFoundException"
        assert exception_values[2]["value"] == "File error: def not found"

    def test_dart_partial_deobfuscation_direct(self) -> None:
        """Test partial deobfuscation when some symbols are not in the map."""
        # Upload symbols that only contain xyz mapping
        partial_symbols = b'["NetworkException", "xyz"]'
        self.upload_dart_symbols(data=partial_symbols)

        data = {
            "project": self.project.id,
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter", "version": "7.0.0"},
            "debug_meta": {
                "images": [
                    {
                        "debug_id": DART_SYMBOLS_UUID,
                    }
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        "value": "Error: xyz was thrown",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    },
                    {
                        "type": "unknown_symbol",
                        "value": "Error: unknown_symbol occurred",
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    },
                ]
            },
        }

        # Get and apply preprocessor
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1
        preprocessors[0](data)

        # Only xyz type should be deobfuscated, values remain unchanged
        exception_values = data["exception"]["values"]
        assert exception_values[0]["type"] == "NetworkException"
        assert exception_values[0]["value"] == "Error: xyz was thrown"
        # Unknown symbol should remain unchanged
        assert exception_values[1]["type"] == "unknown_symbol"
        assert exception_values[1]["value"] == "Error: unknown_symbol occurred"

    def test_dart_exception_without_value_direct(self) -> None:
        """Test deobfuscation when exception has no value field."""
        self.upload_dart_symbols()

        data = {
            "project": self.project.id,
            "platform": "dart",
            "sdk": {"name": "sentry.dart.flutter", "version": "7.0.0"},
            "debug_meta": {
                "images": [
                    {
                        "debug_id": DART_SYMBOLS_UUID,
                    }
                ]
            },
            "exception": {
                "values": [
                    {
                        "type": "xyz",
                        # No value field
                        "stacktrace": {"frames": [{"platform": "native"}]},
                    }
                ]
            },
        }

        # Get and apply preprocessor
        preprocessors = self.plugin.get_event_preprocessors(data)
        assert len(preprocessors) == 1
        preprocessors[0](data)

        # Type should be deobfuscated, value should be absent
        exception_values = data["exception"]["values"]
        assert exception_values[0]["type"] == "NetworkException"
        assert "value" not in exception_values[0]
