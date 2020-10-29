from __future__ import absolute_import

import six
import re

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.utils import safe, json
from sentry.models.relay import Relay
from sentry.testutils import APITestCase

from sentry_relay.auth import generate_key_pair


def _get_all_keys(config):
    for key in config:
        yield key
        if isinstance(config[key], dict):
            for key in _get_all_keys(config[key]):
                yield key


class RelayProjectIdsEndpointTest(APITestCase):
    _date_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")

    def _setup_relay(self, internal, add_org_key):
        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]
        self.relay_id = six.text_type(uuid4())

        self.relay = Relay.objects.create(
            relay_id=self.relay_id, public_key=self.public_key, is_internal=internal,
        )

        self.project = self.create_project()
        self.project.update_option("sentry:scrub_ip_address", True)
        self.path = reverse("sentry-api-0-relay-projectids")

        self.project_key = self.create_project_key()

        org = self.project.organization

        if add_org_key:
            org.update_option(
                "sentry:trusted-relays",
                [{"public_key": six.text_type(self.relay.public_key), "name": "main-relay"}],
            )

    def _call_endpoint(self, public_key):
        raw_json, signature = self.private_key.pack({"publicKeys": [public_key]})

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    def test_internal_relay(self):
        self._setup_relay(internal=True, add_org_key=True)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key)

        assert status_code < 400
        assert safe.get_path(result, "projectIds", public_key) == self.project.id

    def test_external_relay(self):
        self._setup_relay(internal=False, add_org_key=True)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key)

        assert status_code < 400
        assert safe.get_path(result, "projectIds", public_key) == self.project.id

    def test_unknown_key(self):
        self._setup_relay(internal=True, add_org_key=True)

        public_key = "feedfacefeedfacefeedfacefeedface"
        result, status_code = self._call_endpoint(public_key)

        assert status_code < 400
        assert safe.get_path(result, "projectIds", public_key) is None

    def test_unauthorized_relay(self):
        self._setup_relay(internal=False, add_org_key=False)

        public_key = self.project_key.public_key
        result, status_code = self._call_endpoint(public_key)

        assert status_code < 400
        # NB: Unauthorized Relays also receive the project id, but cannot fetch
        # the project ID afterwards.
        assert safe.get_path(result, "projectIds", public_key) == self.project.id
