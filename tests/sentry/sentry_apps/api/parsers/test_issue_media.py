from __future__ import annotations

import unittest
from typing import int, Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestIssueMediaSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema: dict[str, Any] = {
            "type": "issue-media",
            "title": "Video Playback",
            "elements": [{"type": "video", "url": "https://example.com/video.mov"}],
        }

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_title(self) -> None:
        del self.schema["title"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_title_type(self) -> None:
        self.schema["title"] = 1
        validate_component(self.schema)

    @invalid_schema
    def test_missing_elements(self) -> None:
        del self.schema["elements"]
        validate_component(self.schema)

    @invalid_schema
    def test_no_elements(self) -> None:
        self.schema["elements"] = []
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_element(self) -> None:
        self.schema["elements"].append(
            {"type": "select", "name": "thing", "label": "Thing", "options": [["a", "a"]]}
        )
        validate_component(self.schema)
