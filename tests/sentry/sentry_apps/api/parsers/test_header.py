from __future__ import annotations

import unittest
from typing import int, Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestHeaderSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema: dict[str, Any] = {"type": "header", "text": "Beep"}

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_text(self) -> None:
        del self.schema["text"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_text_type(self) -> None:
        self.schema["text"] = 1
        validate_component(self.schema)
