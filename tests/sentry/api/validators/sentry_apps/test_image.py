from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema
from sentry.api.validators.sentry_apps.schema import validate_component


class TestImageSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            "type": "image",
            "url": "https://example.com/image.gif",
            "alt": "example video",
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_url(self):
        del self.schema["url"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_url(self):
        self.schema["url"] = "not-a-url"
        validate_component(self.schema)

    def test_missing_alt(self):
        del self.schema["alt"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_alt_type(self):
        self.schema["alt"] = 1
        validate_component(self.schema)
