from __future__ import annotations

import unittest
from typing import int, Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestImageSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema: dict[str, Any] = {
            "type": "image",
            "url": "https://example.com/image.gif",
            "alt": "example video",
        }

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_url(self) -> None:
        del self.schema["url"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_url(self) -> None:
        self.schema["url"] = "not-a-url"
        validate_component(self.schema)

    def test_missing_alt(self) -> None:
        del self.schema["alt"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_alt_type(self) -> None:
        self.schema["alt"] = 1
        validate_component(self.schema)
