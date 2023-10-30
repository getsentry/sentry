from __future__ import annotations

import unittest
from typing import Any

from fixtures.schema_validation import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestMarkdownSchemaValidation(unittest.TestCase):
    def setUp(self):
        self.schema: dict[str, Any] = {
            "type": "markdown",
            "text": """
# This Is a Title
- this
- is
- a
- list
            """,
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_text(self):
        del self.schema["text"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_text_type(self):
        self.schema["text"] = 1
        validate_component(self.schema)
