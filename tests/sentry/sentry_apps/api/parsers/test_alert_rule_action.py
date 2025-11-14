from __future__ import annotations

import unittest
from typing import int, Any

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestAlertRuleActionSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema: dict[str, Any] = {
            "type": "alert-rule-action",
            "title": "Create Task",
            "settings": {
                "type": "alert-rule-settings",
                "description": "This integration allows you to create a task.",
                "uri": "/sentry/alert-rule",
                "required_fields": [{"type": "text", "name": "channel", "label": "Channel"}],
                "optional_fields": [{"type": "text", "name": "prefix", "label": "Prefix"}],
            },
        }

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_required_fields_fails(self) -> None:
        del self.schema["settings"]["required_fields"]
        validate_component(self.schema)
