from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.api.validators.sentry_apps.schema import validate


class TestSchemaValidation(TestCase):
    def setUp(self):
        self.schema = {
            'elements': [
                {
                    'type': 'issue-link',
                    'link': {
                        'uri': '/sentry/issues/link',
                        'required_fields': [
                            {
                                'type': 'select',
                                'name': 'assignee',
                                'label': 'Assignee',
                                'uri': '/sentry/members',
                            },
                        ],
                    },

                    'create': {
                        'uri': '/sentry/issues/create',
                        'required_fields': [
                            {
                                'type': 'text',
                                'name': 'title',
                                'label': 'Title',
                            },
                            {
                                'type': 'text',
                                'name': 'summary',
                                'label': 'Summary',
                            },
                        ],

                        'optional_fields': [
                            {
                                'type': 'select',
                                'name': 'points',
                                'label': 'Points',
                                'options': [
                                    ['1', '1'],
                                    ['2', '2'],
                                    ['3', '3'],
                                    ['5', '5'],
                                    ['8', '8'],
                                ],
                            },
                            {
                                'type': 'select',
                                'name': 'assignee',
                                'label': 'Assignee',
                                'uri': '/sentry/members',
                            },
                        ],
                    },
                },
                {
                    'type': 'alert-rule-action',
                    'required_fields': [
                        {
                            'type': 'text',
                            'name': 'channel',
                            'label': 'Channel',
                        },
                        {
                            'type': 'select',
                            'name': 'send_email',
                            'label': 'Send Email?',
                            'options': [
                                ['Yes', 'yes'],
                                ['No', 'no'],
                            ],
                        },
                    ],
                },
                {
                    'type': 'issue-media',
                    'title': 'Feature Demo',
                    'elements': [
                        {
                            'type': 'video',
                            'url': '/sentry/issues/video',
                        },
                    ]
                },
                {
                    'type': 'stacktrace-link',
                    'uri': '/sentry/issue',
                },
            ],
        }

    def test_valid_schema_with_options(self):
        validate(self.schema)
