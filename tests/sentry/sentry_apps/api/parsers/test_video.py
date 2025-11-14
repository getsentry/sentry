from typing import int
import unittest

from fixtures.schema_validation import invalid_schema
from sentry.sentry_apps.api.parsers.schema import validate_component


class TestVideoSchemaValidation(unittest.TestCase):
    def setUp(self) -> None:
        self.schema = {"type": "video", "url": "https://example.com/video.mov"}

    def test_valid_schema(self) -> None:
        validate_component(self.schema)

    @invalid_schema
    def test_missing_url(self) -> None:
        del self.schema["url"]
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_url(self) -> None:
        self.schema["url"] = "not-a-url"
        validate_component(self.schema)
