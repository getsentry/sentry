from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema, validate_component


class TestVideoSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            'type': 'video',
            'url': 'https://example.com/video.mov',
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_url(self):
        del self.schema['url']
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_url(self):
        self.schema['url'] = 'not-a-url'
        validate_component(self.schema)
