from __future__ import annotations

import unittest
from typing import Any

from fixtures.schema_validation import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestAlertRuleActionSchemaValidation(unittest.TestCase):
    def setUp(self):
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

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_required_fields_fails(self):
        del self.schema["settings"]["required_fields"]
        validate_component(self.schema)
