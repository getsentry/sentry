from __future__ import absolute_import

import six

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.models import Relay
from sentry.testutils import APITestCase

from semaphore import generate_key_pair


class RelayChangeSetStoreV7Test(APITestCase):
    def setUp(self):
        super(RelayChangeSetStoreV7Test, self).setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]
        self.relay_id = six.binary_type(uuid4())

        self.relay = Relay.objects.create(
            relay_id=self.relay_id,
            public_key=six.binary_type(self.public_key),
        )

        self.project = self.create_project()

        self.path = reverse(
            'sentry-api-0-relay-heartbeat'
        )

        self.data = {
            'changesets': [
                {
                    'type': 'store_v7',
                    'project_id': self.project.id,
                    'data': {
                        'public_key': self.projectkey.public_key,
                        'meta': {
                            'origin': 'http://localhost:1337/',
                            'remote_addr': '127.0.0.1',
                            'sentry_client': 'raven-js/3.23.3'
                        },
                        'event': {
                            'event_id': 'efc75e1a3d2d4f7b9ce90520a5225edb',
                            'culprit': 'http://localhost:1337/error.js',
                            'logger': 'javascript',
                            'platform': 'javascript',
                            'request': {
                                'url': 'http://localhost:1337/',
                                'headers': {
                                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36'
                                }
                            },
                            'breadcrumbs': [
                                {
                                    'timestamp': 1524557689,
                                    'type': 'default',
                                    'category': 'console',
                                    'level': 'warning',
                                    'message': '@sentry/browser configured'
                                },
                                {
                                    'timestamp': 1524557689,
                                    'type': 'default',
                                    'category': 'console',
                                    'level': 'warning',
                                    'message': '4 exceptions captured and queued'
                                },
                                {
                                    'timestamp': 1524557689,
                                    'type': 'default',
                                    'category': 'console',
                                    'level': 'warning',
                                    'message': 'Draining queue...'
                                }
                            ],
                            'exception': {
                                'values': [
                                    {
                                        'type': 'Error',
                                        'value': 'regular exception no. 1',
                                        'stacktrace': {
                                            'frames': [
                                                {
                                                    'function': '?',
                                                    'filename': 'http://localhost:1337/error.js',
                                                    'lineno': 29,
                                                    'colno': 3,
                                                    'in_app': True
                                                },
                                                {
                                                    'function': '?',
                                                    'filename': 'http://localhost:1337/error.js',
                                                    'lineno': 28,
                                                    'colno': 3,
                                                    'in_app': True
                                                },
                                                {
                                                    'function': 'foo',
                                                    'filename': 'http://localhost:1337/error.js',
                                                    'lineno': 13,
                                                    'colno': 11,
                                                    'in_app': True
                                                }
                                            ]
                                        }
                                    }
                                ]
                            },
                            'extra': {
                                'session:duration': 8
                            },
                            'sdk': {
                                'name': 'sentry-browser',
                                'version': '3.23.3'
                            },
                            'project': '10',
                            'trimHeadFrames': 0
                        }
                    }
                }
            ],
            'queries': {}
        }

    def test_storev7(self):
        raw_json, signature = self.private_key.pack(self.data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_invalid_changeset(self):
        self.data['changesets'][0]['type'] = 'abc'
        raw_json, signature = self.private_key.pack(self.data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
