import re
import uuid
from unittest import mock

from django.test import override_settings
from django.urls import reverse
from sentry_relay.auth import generate_key_pair

from sentry.auth import system
from sentry.models.relay import Relay
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json, safe


# Note this is duplicated in test_relay_publickeys (maybe put in a common utils)
def disable_internal_networks():
    return mock.patch.object(system, "INTERNAL_NETWORKS", ())


def _get_all_keys(config):
    for key in config:
        yield key
        if isinstance(config[key], dict):
            for key in _get_all_keys(config[key]):
                yield key


@region_silo_test
class RelayProjectIdsEndpointTest(APITestCase):
    _date_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")

    def setUp(self):
        self.path = reverse("sentry-api-0-relay-projectids")
        sk, pk = generate_key_pair()
        self.public_key = pk
        self.private_key = sk
        self.relay_id = str(uuid.uuid4())
        self.project = self.create_project()
        self.project.update_option("sentry:scrub_ip_address", True)

        self.project_key = self.create_project_key()

    def _setup_relay(self, add_org_key):
        self.relay = Relay.objects.create(
            relay_id=self.relay_id,
            public_key=self.public_key,
        )

        if add_org_key:
            org = self.project.organization
            org.update_option(
                "sentry:trusted-relays",
                [{"public_key": str(self.public_key), "name": "main-relay"}],
            )

    def _call_endpoint(self, public_key, internal):
        raw_json, signature = self.private_key.pack({"publicKeys": [public_key]})

        if internal:
            internal_relays = [str(self.public_key)]
        else:
            internal_relays = []

        with disable_internal_networks():
            with override_settings(SENTRY_RELAY_WHITELIST_PK=internal_relays):
                resp = self.client.post(
                    self.path,
                    data=raw_json,
                    content_type="application/json",
                    HTTP_X_SENTRY_RELAY_ID=self.relay_id,
                    HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
                )

        return json.loads(resp.content), resp.status_code

    def _call_endpoint_static_relay(self, internal):
        raw_json, signature = self.private_key.pack({"publicKeys": [str(self.public_key)]})

        static_auth = {self.relay_id: {"internal": internal, "public_key": str(self.public_key)}}
        with self.settings(SENTRY_OPTIONS={"relay.static_auth": static_auth}):
            resp = self.client.post(
                self.path,
                data=raw_json,
                content_type="application/json",
                HTTP_X_SENTRY_RELAY_ID=self.relay_id,
                HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
            )
        return json.loads(resp.content), resp.status_code

    def test_internal_relay(self):
        self._setup_relay(add_org_key=True)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key, internal=True)

        assert status_code < 400
        assert safe.get_path(result, "projectIds", public_key) == self.project.id

    def test_external_relay(self):
        self._setup_relay(add_org_key=True)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key, internal=False)

        assert status_code < 400
        assert safe.get_path(result, "projectIds", public_key) == self.project.id

    def test_unknown_key(self):
        self._setup_relay(add_org_key=True)

        public_key = "feedfacefeedfacefeedfacefeedface"
        result, status_code = self._call_endpoint(public_key, internal=True)

        assert status_code < 400
        with override_settings(SENTRY_RELAY_WHITELIST_PK=[str(self.public_key)]):
            assert safe.get_path(result, "projectIds", public_key) is None

    def test_unauthorized_relay(self):
        self._setup_relay(add_org_key=False)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key, internal=False)

        assert status_code < 400
        # NB: Unauthorized Relays also receive the project id, but cannot fetch
        # the project ID afterwards.
        assert safe.get_path(result, "projectIds", public_key) == self.project.id

    def test_statically_configured_relay(self):
        result, status_code = self._call_endpoint_static_relay(internal=True)
        assert status_code < 400
