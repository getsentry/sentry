import tempfile
from typing import int, Any
from unittest import mock

from sentry.lang.dart.utils import (
    deobfuscate_exception_type,
    generate_dart_symbols_map,
    get_debug_meta_image_ids,
)
from sentry.models.project import Project

MOCK_DEBUG_FILE = b'["","","_NativeInteger","_NativeInteger","SemanticsAction","er","ButtonTheme","mD","_entry","_YMa"]'
MOCK_DEBUG_MAP = {
    "": "",
    "_NativeInteger": "_NativeInteger",
    "er": "SemanticsAction",
    "mD": "ButtonTheme",
    "_YMa": "_entry",
}


# def test_view_hierarchy_type_regex() -> None:
#     matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "abc")
#     assert matcher
#     assert matcher.groups() == ("abc", None)

#     matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "abc<xyz>")
#     assert matcher
#     assert matcher.groups() == ("abc", "xyz")

#     matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "_abc<_xyz@1>")
#     assert matcher
#     assert matcher.groups() == ("_abc", "_xyz@1")


def test_generate_dart_symbols_map() -> None:
    with tempfile.NamedTemporaryFile() as mocked_debug_file:
        mocked_debug_file.write(MOCK_DEBUG_FILE)
        mocked_debug_file.seek(0)

        # Mock the dif file to return a map from the test uuid to the
        # mocked file location for reading since we don't have the real file
        with mock.patch(
            "sentry.models.ProjectDebugFile.difcache.fetch_difs",
            return_value={"test-uuid": mocked_debug_file.name},
        ):
            map = generate_dart_symbols_map(["test-uuid"], mock.Mock())

            assert map == MOCK_DEBUG_MAP


def test_generate_dart_symbols_map_dict_format_fails() -> None:
    """Test that dict format files are not supported by generate_dart_symbols_map.

    Note: Dict format files (starting with '{') would be detected as Il2Cpp
    by detect_dif_from_path, not as dartsymbolmap. Even if encountered directly,
    the map generation logic rejects non-array formats.
    """
    MOCK_DEBUG_FILE_DICT = b'{"xyz": "ExceptionClass", "abc": "AnotherClass"}'

    with tempfile.NamedTemporaryFile() as mocked_debug_file:
        mocked_debug_file.write(MOCK_DEBUG_FILE_DICT)
        mocked_debug_file.seek(0)

        with mock.patch(
            "sentry.models.ProjectDebugFile.difcache.fetch_difs",
            return_value={"test-uuid": mocked_debug_file.name},
        ):
            # Should return None because dict format is not supported
            map = generate_dart_symbols_map(["test-uuid"], mock.Mock())
            assert map is None


def test_generate_dart_symbols_map_odd_array_fails() -> None:
    """Test that dart symbols map with odd number of elements returns None."""
    MOCK_DEBUG_FILE_ODD = b'["one", "two", "three"]'  # Odd number of elements

    with tempfile.NamedTemporaryFile() as mocked_debug_file:
        mocked_debug_file.write(MOCK_DEBUG_FILE_ODD)
        mocked_debug_file.seek(0)

        with mock.patch(
            "sentry.models.ProjectDebugFile.difcache.fetch_difs",
            return_value={"test-uuid": mocked_debug_file.name},
        ):
            map = generate_dart_symbols_map(["test-uuid"], mock.Mock())
            assert map is None


def test_generate_dart_symbols_map_no_file() -> None:
    """Test that None is returned when debug file is not found."""
    with mock.patch(
        "sentry.models.ProjectDebugFile.difcache.fetch_difs",
        return_value={},  # No file found
    ):
        map = generate_dart_symbols_map(["test-uuid"], mock.Mock())
        assert map is None


def test_generate_dart_symbols_map_multiple_debug_ids() -> None:
    """Test that the function tries multiple debug IDs and returns the first valid mapping."""
    with tempfile.NamedTemporaryFile() as mocked_debug_file:
        mocked_debug_file.write(MOCK_DEBUG_FILE)
        mocked_debug_file.seek(0)

        # Mock so that first debug ID has no file, but second one does
        def mock_fetch_difs(
            project: Project, debug_ids: list[str], features: list[str]
        ) -> dict[str, str]:
            if "second-uuid" in debug_ids:
                return {"second-uuid": mocked_debug_file.name}  # File found for second UUID
            return {}

        with mock.patch(
            "sentry.models.ProjectDebugFile.difcache.fetch_difs",
            side_effect=mock_fetch_difs,
        ):
            # Should return the mapping from the second debug ID
            map = generate_dart_symbols_map(["first-uuid", "second-uuid"], mock.Mock())
            assert map == MOCK_DEBUG_MAP


def test_get_debug_meta_image_ids() -> None:
    """Test extracting debug meta image IDs from event data."""
    event = {
        "debug_meta": {
            "images": [
                {"debug_id": "ABC123-DEF456", "type": "dart_symbols"},
                {"debug_id": "789XYZ-012345", "type": "native"},
                {"debug_id": "DART789-SYMBOL", "type": "dart_symbols"},
            ]
        }
    }

    debug_ids = get_debug_meta_image_ids(event)
    # Should return all debug_ids (lowercased)
    assert debug_ids == {"abc123-def456", "789xyz-012345", "dart789-symbol"}


def test_get_debug_meta_image_ids_no_debug_meta() -> None:
    """Test that empty set is returned when no debug_meta exists."""
    event: dict[str, Any] = {}
    debug_ids = get_debug_meta_image_ids(event)
    assert debug_ids == set()


def test_deobfuscate_exception_type() -> None:
    """Test deobfuscation of exception types."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    "value": "Error: xyz occurred in the app",
                },
                {
                    "type": "abc",
                    "value": "Another error: abc was thrown",
                },
            ]
        },
    }

    # Mock the map generation
    mock_map = {
        "xyz": "NetworkException",
        "abc": "DatabaseException",
    }

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        deobfuscate_exception_type(data)

        # Check that exception types are deobfuscated
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        # Values without "Instance of" pattern should remain unchanged
        assert data["exception"]["values"][0]["value"] == "Error: xyz occurred in the app"

        assert data["exception"]["values"][1]["type"] == "DatabaseException"
        assert data["exception"]["values"][1]["value"] == "Another error: abc was thrown"


def test_deobfuscate_exception_type_no_debug_ids() -> None:
    """Test that deobfuscation is skipped when no debug IDs exist."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    "value": "Error: xyz occurred",
                }
            ]
        },
    }

    original_type = data["exception"]["values"][0]["type"]
    original_value = data["exception"]["values"][0]["value"]

    with mock.patch(
        "sentry.models.Project.objects.get_from_cache",
        return_value=mock_project,
    ):
        deobfuscate_exception_type(data)

        # Should remain unchanged
        assert data["exception"]["values"][0]["type"] == original_type
        assert data["exception"]["values"][0]["value"] == original_value


def test_deobfuscate_exception_type_no_exceptions() -> None:
    """Test that deobfuscation handles missing exception data gracefully."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
    }

    with mock.patch(
        "sentry.models.Project.objects.get_from_cache",
        return_value=mock_project,
    ):
        # Should not raise any exceptions
        deobfuscate_exception_type(data)


def test_deobfuscate_exception_type_missing_value() -> None:
    """Test deobfuscation when exception value is missing."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    # No value field
                }
            ]
        },
    }

    mock_map = {"xyz": "NetworkException"}

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        deobfuscate_exception_type(data)

        # Type should be deobfuscated, value should not crash
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        assert "value" not in data["exception"]["values"][0]


def test_deobfuscate_exception_type_no_mapping_file() -> None:
    """Test that deobfuscation stops when no mapping file is found."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    "value": "Error",
                }
            ]
        },
    }

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=None,  # No mapping file found
        ),
    ):
        original_type = data["exception"]["values"][0]["type"]
        deobfuscate_exception_type(data)

        # Should remain unchanged
        assert data["exception"]["values"][0]["type"] == original_type


def test_deobfuscate_exception_type_non_string_value() -> None:
    """Test that non-string exception values don't cause AttributeError."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    "value": 12345,  # Non-string value
                },
                {
                    "type": "abc",
                    "value": {"error": "details"},  # Dict value
                },
                {
                    "type": "def",
                    "value": ["list", "of", "errors"],  # List value
                },
            ]
        },
    }

    mock_map = {
        "xyz": "NetworkException",
        "abc": "DatabaseException",
        "def": "FileException",
    }

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        # Should not raise AttributeError
        deobfuscate_exception_type(data)

        # Types should be deobfuscated, but values should remain unchanged
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        assert data["exception"]["values"][0]["value"] == 12345  # Unchanged

        assert data["exception"]["values"][1]["type"] == "DatabaseException"
        assert data["exception"]["values"][1]["value"] == {"error": "details"}  # Unchanged

        assert data["exception"]["values"][2]["type"] == "FileException"
        assert data["exception"]["values"][2]["value"] == ["list", "of", "errors"]  # Unchanged


def test_deobfuscate_exception_type_instance_of_pattern() -> None:
    """Test that 'Instance of' patterns are properly deobfuscated."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "xyz",
                    "value": "Instance of 'xyz'",
                },
                {
                    "type": "abc",
                    "value": "Unhandled Exception: Instance of 'abc' was thrown",
                },
                {
                    "type": "def",
                    "value": "Error: def occurred outside of Instance pattern",
                },
                {
                    "type": "ghi",
                    "value": "Instance of 'xyz' and Instance of 'ghi' both occurred",
                },
            ]
        },
    }

    mock_map = {
        "xyz": "NetworkException",
        "abc": "DatabaseException",
        "def": "FileException",
        "ghi": "IOException",
    }

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        deobfuscate_exception_type(data)

        # Exception types should be deobfuscated
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        # Value starts with pattern: quoted symbol should be deobfuscated
        assert data["exception"]["values"][0]["value"] == "Instance of 'NetworkException'"

        assert data["exception"]["values"][1]["type"] == "DatabaseException"
        # Pattern can appear anywhere: deobfuscate occurrences
        assert (
            data["exception"]["values"][1]["value"]
            == "Unhandled Exception: Instance of 'DatabaseException' was thrown"
        )

        assert data["exception"]["values"][2]["type"] == "FileException"
        # No pattern, value should remain unchanged
        assert (
            data["exception"]["values"][2]["value"]
            == "Error: def occurred outside of Instance pattern"
        )

        assert data["exception"]["values"][3]["type"] == "IOException"
        assert (
            data["exception"]["values"][3]["value"]
            == "Instance of 'NetworkException' and Instance of 'IOException' both occurred"
        )


def test_deobfuscate_exception_type_special_regex_chars() -> None:
    """Test that symbols containing regex special characters are handled correctly in Instance of patterns."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {
                    "type": "a.b",
                    "value": "Instance of 'a.b'",
                },
                {
                    "type": "x+y",
                    "value": "Instance of 'x+y' occurred",
                },
                {
                    "type": "test[0]",
                    "value": "Instance of 'test[0]' and Instance of 'other' patterns",
                },
            ]
        },
    }

    mock_map = {
        "a.b": "NetworkException",
        "x+y": "MathException",
        "test[0]": "ArrayException",
    }

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        deobfuscate_exception_type(data)

        # Exception types deobfuscated; values with the pattern are updated
        assert data["exception"]["values"][0]["type"] == "NetworkException"
        assert data["exception"]["values"][0]["value"] == "Instance of 'NetworkException'"

        assert data["exception"]["values"][1]["type"] == "MathException"
        assert data["exception"]["values"][1]["value"] == "Instance of 'MathException' occurred"

        assert data["exception"]["values"][2]["type"] == "ArrayException"
        assert (
            data["exception"]["values"][2]["value"]
            == "Instance of 'ArrayException' and Instance of 'other' patterns"
        )


def test_deobfuscate_exception_value_without_type() -> None:
    """Values should be deobfuscated even if the exception type is missing or None."""
    mock_project = mock.Mock(id=123)

    data: dict[str, Any] = {
        "project": 123,
        "debug_meta": {"images": [{"debug_id": "test-debug-id"}]},
        "exception": {
            "values": [
                {"type": None, "value": "Instance of 'xyz'"},
                {"value": "Unhandled Exception: Instance of 'xyz' was thrown"},
                {"type": None, "value": "No pattern here"},
            ]
        },
    }

    mock_map = {"xyz": "NetworkException"}

    with (
        mock.patch(
            "sentry.models.Project.objects.get_from_cache",
            return_value=mock_project,
        ),
        mock.patch(
            "sentry.lang.dart.utils.generate_dart_symbols_map",
            return_value=mock_map,
        ),
    ):
        deobfuscate_exception_type(data)

        # First: type is None, value should be deobfuscated, type remains None
        assert data["exception"]["values"][0]["type"] is None
        assert data["exception"]["values"][0]["value"] == "Instance of 'NetworkException'"

        # Second: type key missing, value should be deobfuscated
        assert (
            data["exception"]["values"][1]["value"]
            == "Unhandled Exception: Instance of 'NetworkException' was thrown"
        )
        assert "type" not in data["exception"]["values"][1]

        # Third: no pattern; unchanged
        assert data["exception"]["values"][2]["type"] is None
        assert data["exception"]["values"][2]["value"] == "No pattern here"
