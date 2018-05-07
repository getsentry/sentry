from __future__ import absolute_import

import six

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase

from smith import generate_key_pair


class RelayRegisterChallengeTest(APITestCase):
    def setUp(self):
        super(RelayRegisterChallengeTest, self).setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]
        self.relay_id = six.binary_type(uuid4())

        self.path = reverse(
            'sentry-api-0-relay-register-challenge'
        )

    def test_valid_regist(self):
        data = {
            'public_key': six.binary_type(self.public_key),
            'relay_id': self.relay_id,
        }

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type='application/json',
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
