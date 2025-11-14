from __future__ import annotations

import unittest
from typing import int, Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestSelectSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema: dict[str, Any] = {
            "type": "select",
            "name": "title",
            "label": "Title",
            "options": [["Stuff", "stuff"], ["Things", "things"]],
        }

    def test_valid_schema_with_options(self) -> None:
        validate_component(self.schema)

    def test_valid_schema_options_with_numeric_value(self) -> None:
        self.schema["options"][0][1] = 1
        self.schema["options"][1][1] = 2

        validate_component(self.schema)

    def test_valid_schema_with_uri(self) -> None:
        del self.schema["options"]
        self.schema["uri"] = "/foo"

        validate_component(self.schema)

    @invalid_schema
    def test_invalid_schema_missing_uri_and_options(self) -> None:
        del self.schema["options"]

        validate_component(self.schema)

    @invalid_schema
    def test_invalid_schema_missing_name(self) -> None:
        del self.schema["name"]

        validate_component(self.schema)
