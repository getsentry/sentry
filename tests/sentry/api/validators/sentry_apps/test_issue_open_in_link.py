from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema, validate_component


class TestOpenInSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            'type': 'issue-open-in-link',
            'uri': '/sentry/issue',
            'params': ['project', 'filename'],
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    def test_no_params(self):
        del self.schema['params']
        validate_component(self.schema)

    def test_empty_params(self):
        self.schema['params'] = []
        validate_component(self.schema)

    @invalid_schema
    def test_missing_uri(self):
        del self.schema['uri']
        validate_component(self.schema)

    @invalid_schema
    def test_invalid_params_option(self):
        self.schema['params'] = ['project', 'tag']
        validate_component(self.schema)
