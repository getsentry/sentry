from __future__ import annotations

import unittest
from typing import Any

from fixtures.schema_validation import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestIssueMediaSchemaValidation(unittest.TestCase):
    def setUp(self):
        self.schema: dict[str, Any] = {
            "type": "issue-media",
            "title": "Video Playback",
            "elements": [{"type": "video", "url": "https://example.com/video.mov"}],
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_title(self):
        del self.schema["title"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_title_type(self):
        self.schema["title"] = 1
        validate_component(self.schema)

    @invalid_schema
    def test_missing_elements(self):
        del self.schema["elements"]
        validate_component(self.schema)

    @invalid_schema
    def test_no_elements(self):
        self.schema["elements"] = []
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_element(self):
        self.schema["elements"].append(
            {"type": "select", "name": "thing", "label": "Thing", "options": [["a", "a"]]}
        )
        validate_component(self.schema)
