from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestHeaderSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {"type": "header", "text": "Beep"}

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
