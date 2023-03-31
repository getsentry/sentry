import re
import tempfile
from unittest import mock

from sentry.lang.dart.utils import (
    VIEW_HIERARCHY_TYPE_REGEX,
    _deobfuscate_view_hierarchy,
    generate_dart_symbols_map,
)

MOCK_DEBUG_FILE = b'["","","_NativeInteger","_NativeInteger","SemanticsAction","er","ButtonTheme","mD","_entry","_YMa"]'
MOCK_DEBUG_MAP = {
    "": "",
    "_NativeInteger": "_NativeInteger",
    "er": "SemanticsAction",
    "mD": "ButtonTheme",
    "_YMa": "_entry",
}


def test_view_hierarchy_type_regex():
    matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "abc")
    assert matcher
    assert matcher.groups() == ("abc", None)

    matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "abc<xyz>")
    assert matcher
    assert matcher.groups() == ("abc", "xyz")

    matcher = re.match(VIEW_HIERARCHY_TYPE_REGEX, "_abc<_xyz@1>")
    assert matcher
    assert matcher.groups() == ("_abc", "_xyz@1")


def test_generate_dart_symbols_map():
    with tempfile.NamedTemporaryFile() as mocked_debug_file:
        mocked_debug_file.write(MOCK_DEBUG_FILE)
        mocked_debug_file.seek(0)

        # Mock the dif file to return a map from the test uuid to the
        # mocked file location for reading since we don't have the real file
        with mock.patch(
            "sentry.models.ProjectDebugFile.difcache.fetch_difs",
            return_value={"test-uuid": mocked_debug_file.name},
        ):
            map = generate_dart_symbols_map("test-uuid", mock.Mock())

            assert map == MOCK_DEBUG_MAP


@mock.patch("sentry.lang.dart.utils.generate_dart_symbols_map", return_value=MOCK_DEBUG_MAP)
@mock.patch("sentry.lang.dart.utils.get_dart_symbols_images", return_value=["test-uuid"])
def test_view_hierarchy_deobfuscation(mock_images, mock_map):
    test_view_hierarchy = {
        "windows": [
            {
                "type": "mD",
                "children": [
                    {
                        "type": "er",
                        "children": [
                            {"type": "_YMa<er>", "children": [{"type": "_NativeInteger"}]}
                        ],
                    },
                ],
            }
        ]
    }
    _deobfuscate_view_hierarchy(mock.Mock(), mock.Mock(), test_view_hierarchy)

    assert test_view_hierarchy == {
        "windows": [
            {
                "type": "ButtonTheme",
                "children": [
                    {
                        "type": "SemanticsAction",
                        "children": [
                            {
                                "type": "_entry<SemanticsAction>",
                                "children": [{"type": "_NativeInteger"}],
                            }
                        ],
                    }
                ],
            }
        ]
    }
