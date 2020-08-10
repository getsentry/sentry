from __future__ import absolute_import

import six

from uuid import uuid4

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.utils import json
from sentry.models import Relay
from sentry.testutils import APITestCase

from sentry_relay import generate_key_pair


class RelayRegisterTest(APITestCase):
    def setUp(self):
        super(RelayRegisterTest, self).setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        settings.SENTRY_RELAY_WHITELIST_PK.append(six.binary_type(self.public_key))

        self.private_key = self.key_pair[0]
        self.relay_id = six.binary_type(six.text_type(uuid4()).encode("ascii"))

        self.path = reverse("sentry-api-0-relay-register-challenge")

    def test_valid_register(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_register_missing_relay_id(self):
        data = {"public_key": six.binary_type(self.public_key)}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_public_key(self):
        data = {"relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_invalid_body(self):
        resp = self.client.post(
            self.path,
            data="a",
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_header(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_header2(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_wrong_sig(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature + "a",
        )

        assert resp.status_code == 400, resp.content

    def test_valid_register_response(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        relay = Relay.objects.get(relay_id=self.relay_id)
        assert relay
        assert relay.relay_id == self.relay_id

    def test_forge_public_key(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        keys = generate_key_pair()

        settings.SENTRY_RELAY_WHITELIST_PK.append(six.binary_type(keys[1]))

        data = {"public_key": six.binary_type(keys[1]), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_expired_challenge(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        keys = generate_key_pair()

        data = {"token": six.binary_type(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 401, resp.content

    def test_forge_public_key_on_register(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

        keys = generate_key_pair()

        data = {"token": six.binary_type(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_invalid_json_response(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        _, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data="a",
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_missing_token_response(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        del result["token"]

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_missing_sig_response(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_relay_id_missmatch_response(self):
        data = {"public_key": six.binary_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=six.binary_type(six.text_type(uuid4()).encode("ascii")),
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_valid_register_response_twice(self):
        self.test_valid_register_response()
        self.test_valid_register_response()
