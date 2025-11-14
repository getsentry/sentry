from typing import int
import unittest

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestOpenInSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema = {"type": "stacktrace-link", "uri": "/sentry/issue"}

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_uri(self) -> None:
        del self.schema["uri"]
        validate_component(self.schema)
