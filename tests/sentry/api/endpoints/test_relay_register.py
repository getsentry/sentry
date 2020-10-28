from __future__ import absolute_import

import six

from uuid import uuid4

from django.conf import settings
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.utils import json
from sentry.models import Relay, RelayUsage
from sentry.testutils import APITestCase

from sentry_relay import generate_key_pair


class RelayRegisterTest(APITestCase):
    def setUp(self):
        super(RelayRegisterTest, self).setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        settings.SENTRY_RELAY_WHITELIST_PK.append(six.text_type(self.public_key))

        self.private_key = self.key_pair[0]
        self.relay_id = six.text_type(uuid4())

        self.path = reverse("sentry-api-0-relay-register-challenge")

    def add_internal_key(self, public_key):
        if public_key not in settings.SENTRY_RELAY_WHITELIST_PK:
            settings.SENTRY_RELAY_WHITELIST_PK.append(six.text_type(self.public_key))

    def register_relay(self, key_pair, version, relay_id):

        private_key = key_pair[0]
        public_key = key_pair[1]

        data = {"public_key": six.text_type(public_key), "relay_id": relay_id, "version": version}

        raw_json, signature = private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = json.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        data = {
            "token": six.text_type(result.get("token")),
            "relay_id": relay_id,
            "version": version,
        }

        raw_json, signature = private_key.pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_valid_register(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key)}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_header2(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_wrong_sig(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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

        settings.SENTRY_RELAY_WHITELIST_PK.append(six.text_type(keys[1]))

        data = {"public_key": six.text_type(keys[1]), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_public_key_mismatch(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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

        data = {"token": six.text_type(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_forge_public_key_on_register(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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

        data = {"token": six.text_type(result.get("token")), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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

    def test_relay_id_mismatch_response(self):
        data = {"public_key": six.text_type(self.public_key), "relay_id": self.relay_id}

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
            HTTP_X_SENTRY_RELAY_ID=six.text_type(uuid4()),
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_valid_register_response_twice(self):
        self.test_valid_register_response()
        self.test_valid_register_response()

    def test_old_relays_can_register(self):
        """
        Test that an old Relay that does not send version information
        in the challenge response is still able to register.
        """
        data = {
            "public_key": six.text_type(self.public_key),
            "relay_id": self.relay_id,
            "version": "1.0.0",
        }

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

        data = {"token": six.text_type(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_multiple_relay_versions_tracked(self):
        """
        Test that updating the relay version would properly be
        reflected in the relay analytics. Also that tests that
        multiple relays
        """
        key_pair = generate_key_pair()
        relay_id = six.text_type(uuid4())
        before_registration = timezone.now()
        self.register_relay(key_pair, "1.1.1", relay_id)
        after_first_relay = timezone.now()
        self.register_relay(key_pair, "2.2.2", relay_id)
        after_second_relay = timezone.now()

        v1 = Relay.objects.get(relay_id=relay_id)
        assert v1 is not None

        rv1 = RelayUsage.objects.get(relay_id=relay_id, version="1.1.1")
        assert rv1 is not None
        rv2 = RelayUsage.objects.get(relay_id=relay_id, version="2.2.2")
        assert rv2 is not None

        assert rv1.first_seen > before_registration
        assert rv1.last_seen > before_registration
        assert rv1.first_seen < after_first_relay
        assert rv1.last_seen < after_first_relay

        assert rv2.first_seen > after_first_relay
        assert rv2.last_seen > after_first_relay
        assert rv2.first_seen < after_second_relay
        assert rv2.last_seen < after_second_relay

    def test_relay_usage_is_updated_at_registration(self):
        """
        Tests that during registration the proper relay usage information
        is updated
        """

        key_pair = generate_key_pair()
        relay_id = six.text_type(uuid4())
        before_registration = timezone.now()
        # register one relay
        self.register_relay(key_pair, "1.1.1", relay_id)
        after_first_relay = timezone.now()
        # register another one that should not be updated after this
        self.register_relay(key_pair, "2.2.2", relay_id)
        after_second_relay = timezone.now()
        # re register the first one in order to update the last used time
        self.register_relay(key_pair, "1.1.1", relay_id)
        after_re_register = timezone.now()

        rv1 = RelayUsage.objects.get(relay_id=relay_id, version="1.1.1")
        assert rv1 is not None
        rv2 = RelayUsage.objects.get(relay_id=relay_id, version="2.2.2")
        assert rv2 is not None

        # check first seen is not modified by re register
        assert rv1.first_seen > before_registration
        assert rv1.first_seen < after_first_relay
        # check last seen shows the time at re-registration
        assert rv1.last_seen > after_second_relay
        assert rv1.last_seen < after_re_register

        # check version 2.2.2 is not affected by version 1.1.1
        assert rv2.first_seen > after_first_relay
        assert rv2.last_seen > after_first_relay
        assert rv2.first_seen < after_second_relay
        assert rv2.last_seen < after_second_relay
