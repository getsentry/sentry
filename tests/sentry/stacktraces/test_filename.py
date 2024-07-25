from typing import Any
from unittest import TestCase

from sentry.stacktraces.processing import normalize_stacktraces_for_grouping


def _make_event_data(filenames: list[str], platform: str = "") -> dict[str, Any]:
    return {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [{"filename": filename} for filename in filenames],
                    },
                }
            ]
        },
        "platform": platform,
    }


def _get_filenames(event_data: dict[str, Any]) -> list[str]:
    frames = event_data["exception"]["values"][0]["stacktrace"]["frames"]
    return [frame["filename"] for frame in frames]


class FilenameNormalizationTest(TestCase):
    def test_leaves_non_js_events_alone(self):
        filenames = ["whos_a_good_girl?.py", "maisey.py"]
        event_data = _make_event_data(filenames, "python")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_filenames(event_data) == filenames

    def test_leaves_non_querystringed_js_filenames_alone(self):
        filenames = ["maisey.js", "charlie.js"]
        event_data = _make_event_data(filenames, "javascript")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_filenames(event_data) == filenames

    def test_strips_querystrings_from_files_in_js_events(self):
        filenames = ["maisey.js?good=duh", "charlie.html"]
        event_data = _make_event_data(filenames, "javascript")

        normalize_stacktraces_for_grouping(event_data)

        assert _get_filenames(event_data) == ["maisey.js", "charlie.html"]
