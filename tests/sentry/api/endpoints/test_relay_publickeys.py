from unittest import mock
from uuid import uuid4

from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.auth import system
from sentry.models.relay import Relay
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


def disable_internal_networks():
    return mock.patch.object(system, "INTERNAL_NETWORKS", ())


@region_silo_test
class RelayPublicKeysConfigTest(APITestCase):
    def setUp(self):
        super().setUp()

        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]

        self.non_existing_key = str(uuid4())

        self.internal_relay = Relay.objects.create(
            relay_id=str(uuid4()),
            public_key=str(self.public_key),
            is_internal=True,
        )

        self.external_relay = Relay.objects.create(
            relay_id=str(uuid4()),
            public_key=str(self.public_key),
            is_internal=False,
        )
        self.relay_a = Relay.objects.create(
            relay_id=str(uuid4()),
            public_key=str(self.public_key),
            is_internal=False,
        )
        self.relay_b = Relay.objects.create(
            relay_id=str(uuid4()),
            public_key=str(self.public_key),
            is_internal=True,
        )

        self.project = self.create_project()
        self.path = reverse("sentry-api-0-relay-publickeys")

    def test_get_project_config_internal(self):
        result = self._call_endpoint(self.internal_relay)
        legacy_keys = result["public_keys"]
        keys = result["relays"]

        # check legacy
        assert legacy_keys[self.relay_a.relay_id] == self.relay_a.public_key
        assert legacy_keys[self.relay_b.relay_id] == self.relay_b.public_key
        assert legacy_keys[self.non_existing_key] is None

        # check new results
        relay_a_info = keys[self.relay_a.relay_id]
        assert relay_a_info["publicKey"] == self.relay_a.public_key
        assert not relay_a_info["internal"]

        relay_b_info = keys[self.relay_b.relay_id]
        assert relay_b_info["publicKey"] == self.relay_b.public_key
        assert relay_b_info["internal"]

        assert keys[self.non_existing_key] is None

    def test_get_project_config_external(self):

        with disable_internal_networks():
            result = self._call_endpoint(self.external_relay)

        legacy_keys = result["public_keys"]
        keys = result["relays"]

        # check legacy
        assert legacy_keys[self.relay_a.relay_id] == self.relay_a.public_key
        assert legacy_keys[self.relay_b.relay_id] == self.relay_b.public_key
        assert legacy_keys[self.non_existing_key] is None

        # check new results
        relay_a_info = keys[self.relay_a.relay_id]
        assert relay_a_info["publicKey"] == self.relay_a.public_key
        assert not relay_a_info["internal"]

        relay_b_info = keys[self.relay_b.relay_id]
        assert relay_b_info["publicKey"] == self.relay_b.public_key
        assert not relay_b_info["internal"]

        assert keys[self.non_existing_key] is None

    def _call_endpoint(self, calling_relay):

        raw_json, signature = self.private_key.pack(
            {
                "relay_ids": [
                    str(self.relay_a.relay_id),
                    str(self.relay_b.relay_id),
                    self.non_existing_key,
                ]
            }
        )

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=calling_relay.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        result = json.loads(resp.content)
        return result
