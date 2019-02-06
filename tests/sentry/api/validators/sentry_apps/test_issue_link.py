from __future__ import absolute_import

from sentry.testutils import TestCase

from .util import invalid_schema, validate_component


class TestIssueLinkSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            'type': 'issue-link',
            'link': {
                'uri': '/sentry/tasks/link',
                'required_fields': [
                    {
                        'type': 'select',
                        'name': 'task_id',
                        'label': 'Task ID',
                        'uri': '/sentry/tasks',
                    },
                ],
                'optional_fields': [
                    {
                        'type': 'text',
                        'name': 'owner',
                        'label': 'Owner',
                    },
                ]
            },
            'create': {
                'uri': '/sentry/tasks/create',
                'required_fields': [
                    {
                        'type': 'text',
                        'name': 'title',
                        'label': 'Title',
                    },
                    {
                        'type': 'text',
                        'name': 'description',
                        'label': 'Description',
                    },
                ],

                'optional_fields': [
                    {
                        'type': 'text',
                        'name': 'owner',
                        'label': 'Owner',
                    },
                ]
            },
        }

    def test_valid_schema(self):
        validate_component(self.schema)

    @invalid_schema
    def test_missing_create_fails(self):
        del self.schema['create']
        validate_component(self.schema)

    @invalid_schema
    def test_missing_create_uri(self):
        del self.schema['create']['uri']
        validate_component(self.schema)

    @invalid_schema
    def test_missing_create_required_fields(self):
        del self.schema['create']['required_fields']
        validate_component(self.schema)

    @invalid_schema
    def test_create_required_fields_no_elements(self):
        self.schema['create']['required_fields'] = []
        validate_component(self.schema)

    @invalid_schema
    def test_create_required_fields_invalid_element(self):
        self.schema['create']['required_fields'] = [
            {'type': 'markdown'}
        ]
        validate_component(self.schema)

    def test_missing_create_optional_fields(self):
        del self.schema['create']['optional_fields']
        validate_component(self.schema)

    @invalid_schema
    def test_create_optional_fields_invalid_element(self):
        self.schema['create']['optional_fields'] = [
            {'type': 'markdown'}
        ]
        validate_component(self.schema)

    @invalid_schema
    def test_missing_link(self):
        del self.schema['link']
        validate_component(self.schema)

    @invalid_schema
    def test_missing_link_uri(self):
        del self.schema['link']['uri']
        validate_component(self.schema)

    @invalid_schema
    def test_missing_link_required_fields(self):
        del self.schema['link']['required_fields']
        validate_component(self.schema)

    def test_missing_link_optional_fields(self):
        del self.schema['link']['optional_fields']
        validate_component(self.schema)
