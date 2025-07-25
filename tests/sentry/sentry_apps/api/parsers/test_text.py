from __future__ import annotations

import unittest
from typing import Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestTextSchemaValidation(unittest.TestCase):
    def setUp(self):
        self.schema: dict[str, Any] = {"type": "text", "name": "title", "label": "Title"}

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    def test_with_a_valid_default(self) -> None:
        self.schema["default"] = "issue.title"
        validate_component(self.schema)

    @invalid_schema
    def test_missing_name(self) -> None:
        del self.schema["name"]
        validate_component(self.schema)

    @invalid_schema
    def test_missing_label(self) -> None:
        del self.schema["label"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_label_type(self) -> None:
        self.schema["label"] = 1
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_name_type(self) -> None:
        self.schema["name"] = 1
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_default_option(self) -> None:
        self.schema["default"] = "issue.id"
        validate_component(self.schema)
