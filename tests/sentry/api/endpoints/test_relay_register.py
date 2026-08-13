from uuid import uuid4

import orjson
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from sentry_relay.auth import PublicKey, SecretKey, generate_key_pair

from sentry.api.endpoints.relay.register_response import RELAY_USAGE_UPDATE_INTERVAL
from sentry.models.relay import Relay, RelayUsage
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class RelayRegisterTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        settings.SENTRY_RELAY_WHITELIST_PK.append(str(self.public_key))

        self.private_key = self.key_pair[0]
        self.relay_id = str(uuid4())

        self.path = reverse("sentry-api-0-relay-register-challenge")

    def register_relay(
        self, key_pair: tuple[SecretKey, PublicKey], version: str, relay_id: str | int
    ) -> None:
        private_key = key_pair[0]
        public_key = key_pair[1]

        data = {"public_key": str(public_key), "relay_id": relay_id, "version": version}

        raw_json, signature = private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        data = {
            "token": str(result.get("token")),
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

    def test_valid_register(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_register_missing_relay_id(self) -> None:
        data = {"public_key": str(self.public_key)}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_public_key(self) -> None:
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

    def test_register_invalid_body(self) -> None:
        resp = self.client.post(
            self.path,
            data="a",
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_header(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_register_missing_header2(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_register_wrong_sig(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature + "a",
        )

        assert resp.status_code == 400, resp.content

    def test_valid_register_response(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

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

    def test_forge_public_key(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        keys = generate_key_pair()

        settings.SENTRY_RELAY_WHITELIST_PK.append(str(keys[1]))

        data = {"public_key": str(keys[1]), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_public_key_mismatch(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        keys = generate_key_pair()

        data = {"token": str(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_forge_public_key_on_register(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = orjson.loads(resp.content)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

        keys = generate_key_pair()

        data = {"token": str(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = keys[0].pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_invalid_json_response(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        _, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data="a",
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_missing_token_response(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

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

    def test_missing_sig_response(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
        )

        assert resp.status_code == 400, resp.content

    def test_relay_id_mismatch_response(self) -> None:
        data = {"public_key": str(self.public_key), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content
        result = orjson.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=str(uuid4()),
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 400, resp.content

    def test_valid_register_response_twice(self) -> None:
        self.test_valid_register_response()
        self.test_valid_register_response()

    def test_old_relays_can_register(self) -> None:
        """
        Test that an old Relay that does not send version information
        in the challenge response is still able to register.
        """
        data = {
            "public_key": str(self.public_key),
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
        result = orjson.loads(resp.content)

        raw_json, signature = self.private_key.pack(result)

        self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        data = {"token": str(result.get("token")), "relay_id": self.relay_id}

        raw_json, signature = self.private_key.pack(data)

        resp = self.client.post(
            reverse("sentry-api-0-relay-register-response"),
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        assert resp.status_code == 200, resp.content

    def test_multiple_relay_versions_tracked(self) -> None:
        """
        Test that updating the relay version would properly be
        reflected in the relay analytics. Also that tests that
        multiple relays
        """
        key_pair = generate_key_pair()
        relay_id = str(uuid4())
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

    def test_relay_usage_is_updated_at_registration(self) -> None:
        key_pair = generate_key_pair()
        relay_id = str(uuid4())

        with freeze_time() as frozen_time:
            self.register_relay(key_pair, "1.1.1", relay_id)
            relay_usage = RelayUsage.objects.get(relay_id=relay_id, version="1.1.1")
            first_seen = relay_usage.first_seen
            last_seen = relay_usage.last_seen

            frozen_time.shift(RELAY_USAGE_UPDATE_INTERVAL.total_seconds() - 1)
            self.register_relay(key_pair, "1.1.1", relay_id)
            relay_usage.refresh_from_db()
            assert relay_usage.last_seen == last_seen

            frozen_time.shift(2)
            self.register_relay(key_pair, "1.1.1", relay_id)

            relay_usage.refresh_from_db()
            assert relay_usage.first_seen == first_seen
            assert relay_usage.last_seen == timezone.now()

    def test_no_db_for_static_relays(self) -> None:
        """
        Tests that statically authenticated relays do not access
        the database during registration
        """
        key_pair = generate_key_pair()
        relay_id = str(uuid4())
        public_key = key_pair[1]
        static_auth = {relay_id: {"internal": True, "public_key": str(public_key)}}

        with self.assertNumQueries(0):
            with override_settings(SENTRY_RELAY_STATIC_AUTH=static_auth):
                self.register_relay(key_pair, "1.1.1", relay_id)
