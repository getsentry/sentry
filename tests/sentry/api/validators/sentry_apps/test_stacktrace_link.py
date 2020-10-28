from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestOpenInSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {"type": "stacktrace-link", "uri": "/sentry/issue"}

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_uri(self):
        del self.schema["uri"]
        validate_component(self.schema)
