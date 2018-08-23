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
            is_internal=True
        )

        self.project = self.create_project()
        self.path = reverse(
            'sentry-api-0-relay-projectconfigs'
        )

    def test_get_project_config(self):
        projects = [six.text_type(self.project.id)]
        raw_json, signature = self.private_key.pack({'projects': projects})

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)
        cfg = result['configs'][six.text_type(self.project.id)]
        assert not cfg['disabled']
        assert cfg['publicKeys'][self.projectkey.public_key] is True
        assert cfg['slug'] == self.project.slug
        assert cfg['config']['trustedRelays'] == []
