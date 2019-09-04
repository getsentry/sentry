from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestAlertRuleActionSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            "type": "alert-rule-action",
            "required_fields": [{"type": "text", "name": "channel", "label": "Channel"}],
            "optional_fields": [{"type": "text", "name": "prefix", "label": "Prefix"}],
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_required_fields_fails(self):
        del self.schema["required_fields"]
        validate_component(self.schema)
