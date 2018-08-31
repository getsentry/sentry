from __future__ import absolute_import

import json
import six

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.models import Relay
from sentry.testutils import APITestCase

from semaphore import generate_key_pair


class RelayPublicKeysConfigTest(APITestCase):
    def setUp(self):
        super(RelayPublicKeysConfigTest, self).setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]
        self.relay_id = six.text_type(uuid4())

        self.relay = Relay.objects.create(
            relay_id=self.relay_id,
            public_key=six.binary_type(self.public_key),
            is_internal=True
        )
        self.relay_a = Relay.objects.create(
            relay_id=six.text_type(uuid4()),
            public_key=six.binary_type(self.public_key),
            is_internal=False
        )
        self.relay_b = Relay.objects.create(
            relay_id=six.text_type(uuid4()),
            public_key=six.binary_type(self.public_key),
            is_internal=False
        )

        self.project = self.create_project()
        self.path = reverse(
            'sentry-api-0-relay-publickeys'
        )

    def test_get_project_config(self):
        non_existing = six.text_type(uuid4())
        raw_json, signature = self.private_key.pack({'relay_ids': [
            six.text_type(self.relay_a.relay_id),
            six.text_type(self.relay_b.relay_id),
            non_existing,
        ]})

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)
        keys = result['public_keys']

        assert keys[self.relay_a.relay_id] == self.relay_a.public_key
        assert keys[self.relay_b.relay_id] == self.relay_b.public_key
        assert keys[non_existing] is None
