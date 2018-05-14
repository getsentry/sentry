from __future__ import absolute_import

import json
import six

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.models import Relay
from sentry.testutils import APITestCase

from semaphore import generate_key_pair


class RelayQueryGetProjectConfigTest(APITestCase):
    def setUp(self):
        super(RelayQueryGetProjectConfigTest, self).setUp()

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

    def test_get_project_config(self):
        query_id = six.binary_type(uuid4())

        data = {
            'changesets': [],
            'queries': {
                query_id: {
                    'type': 'get_project_config',
                    'project_id': self.project.id,
                    'data': None
                }
            }
        }

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)

        assert resp.status_code == 200, resp.content
        assert result.get('queryResults').get(query_id).get('status') == 'ok'
        query_result = result.get('queryResults').get(query_id).get('result')
        assert query_result.get('publicKeys') is not None
        assert query_result.get('rev') is not None
        assert query_result.get('disabled') is False

    def test_get_project_config_missing_project_id(self):
        query_id = six.binary_type(uuid4())

        data = {
            'changesets': [],
            'queries': {
                query_id: {
                    'type': 'get_project_config',
                    'data': None
                }
            }
        }

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)

        assert resp.status_code == 200, resp.content
        assert result.get('queryResults').get(query_id).get('status') == 'error'

    def test_invalid_query(self):
        query_id = six.binary_type(uuid4())

        data = {
            'changesets': [],
            'queries': {
                query_id: {
                    'type': 'get_project_configg',
                    'project_id': self.project.id,
                    'data': None
                }
            }
        }

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)

        assert resp.status_code == 200, resp.content
        assert result.get('queryResults').get(query_id).get('status') == 'error'
        query_result = result.get('queryResults').get(query_id).get('error')
        assert query_result == 'unknown query'

    def test_project_does_not_exist(self):
        query_id = six.binary_type(uuid4())

        data = {
            'changesets': [],
            'queries': {
                query_id: {
                    'type': 'get_project_config',
                    'project_id': 9999,
                    'data': None
                }
            }
        }

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)

        assert resp.status_code == 200, resp.content
        assert result.get('queryResults').get(query_id).get('status') == 'error'
        query_result = result.get('queryResults').get(query_id).get('error')
        assert query_result == 'Project does not exist'
