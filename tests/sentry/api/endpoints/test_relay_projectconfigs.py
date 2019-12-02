from __future__ import absolute_import

import json
import six
import re

from uuid import uuid4

from django.core.urlresolvers import reverse

from sentry.utils import safe
from sentry.models.relay import Relay
from sentry.testutils import APITestCase

from semaphore.auth import generate_key_pair


def _get_all_keys(config):
    for key in config:
        yield key
        if isinstance(config[key], dict):
            for key in _get_all_keys(config[key]):
                yield key


class RelayQueryGetProjectConfigTest(APITestCase):
    _date_regex = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$")

    def _setup_relay(self, internal, add_org_key):
        self.key_pair = generate_key_pair()

        self.public_key = self.key_pair[1]
        self.private_key = self.key_pair[0]
        self.relay_id = six.binary_type(uuid4())

        self.relay = Relay.objects.create(
            relay_id=self.relay_id,
            public_key=six.binary_type(self.public_key),
            is_internal=internal,
        )

        self.project = self.create_project()
        self.project.update_option("sentry:scrub_ip_address", True)
        self.path = reverse("sentry-api-0-relay-projectconfigs")

        org = self.project.organization

        if add_org_key:
            org.update_option("sentry:trusted-relays", [self.relay.public_key])

    def _call_endpoint(self, full_config):
        projects = [six.text_type(self.project.id)]

        if full_config is None:
            raw_json, signature = self.private_key.pack({"projects": projects})
        else:
            raw_json, signature = self.private_key.pack(
                {"projects": projects, "fullConfig": full_config}
            )

        resp = self.client.post(
            self.path,
            data=raw_json,
            content_type="application/json",
            HTTP_X_SENTRY_RELAY_ID=self.relay_id,
            HTTP_X_SENTRY_RELAY_SIGNATURE=signature,
        )

        return json.loads(resp.content), resp.status_code

    def test_internal_relays_should_receive_minimal_configs_if_they_do_not_explicitly_ask_for_full_config(
        self
    ):
        self._setup_relay(internal=True, add_org_key=False)
        result, status_code = self._call_endpoint(full_config=False)

        assert status_code < 400

        # Sweeping assertion that we do not have any snake_case in that config.
        # Might need refining.
        assert not set(x for x in _get_all_keys(result) if "-" in x or "_" in x)

        cfg = safe.get_path(result, "configs", six.text_type(self.project.id))
        assert safe.get_path(cfg, "config", "filterSettings") is None
        assert safe.get_path(cfg, "config", "groupingConfig") is None

    def test_internal_relays_should_receive_full_configs(self):
        self._setup_relay(internal=True, add_org_key=False)
        result, status_code = self._call_endpoint(full_config=True)

        assert status_code < 400

        # Sweeping assertion that we do not have any snake_case in that config.
        # Might need refining.
        assert not set(x for x in _get_all_keys(result) if "-" in x or "_" in x)

        cfg = safe.get_path(result, "configs", six.text_type(self.project.id))
        assert safe.get_path(cfg, "disabled") is False

        public_key, = cfg["publicKeys"]
        assert public_key["publicKey"] == self.projectkey.public_key
        assert public_key["isEnabled"]
        assert "quotas" in public_key

        assert safe.get_path(cfg, "slug") == self.project.slug
        last_change = safe.get_path(cfg, "lastChange")
        assert self._date_regex.match(last_change) is not None
        last_fetch = safe.get_path(cfg, "lastFetch")
        assert self._date_regex.match(last_fetch) is not None
        assert safe.get_path(cfg, "organizationId") == self.project.organization.id
        assert safe.get_path(cfg, "projectId") == self.project.id
        assert safe.get_path(cfg, "slug") == self.project.slug
        assert safe.get_path(cfg, "rev") is not None

        assert safe.get_path(cfg, "config", "trustedRelays") == []
        assert safe.get_path(cfg, "config", "filterSettings") is not None
        assert safe.get_path(cfg, "config", "groupingConfig", "enhancements") is not None
        assert safe.get_path(cfg, "config", "groupingConfig", "id") is not None
        assert safe.get_path(cfg, "config", "piiConfig", "applications") is None
        assert safe.get_path(cfg, "config", "piiConfig", "rules") is None
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubData") is True
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubDefaults") is True
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubIpAddresses") is True
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "sensitiveFields") == []

    def test_trusted_external_relays_should_not_be_able_to_request_full_configs(self):
        self._setup_relay(False, True)
        result, status_code = self._call_endpoint(full_config=True)

        assert status_code == 403

    def test_when_not_sending_full_config_info_into_a_internal_relay_a_restricted_config_is_returned(
        self
    ):
        self._setup_relay(internal=True, add_org_key=False)
        result, status_code = self._call_endpoint(full_config=None)

        assert status_code < 400

        cfg = safe.get_path(result, "configs", six.text_type(self.project.id))
        assert safe.get_path(cfg, "config", "filterSettings") is None
        assert safe.get_path(cfg, "config", "groupingConfig") is None

    def test_when_not_sending_full_config_info_into_an_external_relay_a_restricted_config_is_returned(
        self
    ):
        self._setup_relay(internal=False, add_org_key=True)
        result, status_code = self._call_endpoint(full_config=None)

        assert status_code < 400

        cfg = safe.get_path(result, "configs", six.text_type(self.project.id))
        assert safe.get_path(cfg, "config", "filterSettings") is None
        assert safe.get_path(cfg, "config", "groupingConfig") is None

    def test_trusted_external_relays_should_receive_minimal_configs(self):
        self._setup_relay(False, True)
        result, status_code = self._call_endpoint(full_config=False)

        assert status_code < 400

        cfg = safe.get_path(result, "configs", six.text_type(self.project.id))
        assert safe.get_path(cfg, "disabled") is False
        public_key, = cfg["publicKeys"]
        assert public_key["publicKey"] == self.projectkey.public_key
        assert public_key["isEnabled"]
        assert "quotas" not in public_key

        assert safe.get_path(cfg, "slug") == self.project.slug
        last_change = safe.get_path(cfg, "lastChange")
        assert self._date_regex.match(last_change) is not None
        last_fetch = safe.get_path(cfg, "lastFetch")
        assert self._date_regex.match(last_fetch) is not None
        assert safe.get_path(cfg, "projectId") == self.project.id
        assert safe.get_path(cfg, "slug") == self.project.slug
        assert safe.get_path(cfg, "rev") is not None

        assert safe.get_path(cfg, "organizationId") is None
        assert safe.get_path(cfg, "config", "trustedRelays") == [self.relay.public_key]
        assert safe.get_path(cfg, "config", "filterSettings") is None
        assert safe.get_path(cfg, "config", "groupingConfig") is None
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubData") is not None
        assert safe.get_path(cfg, "config", "datascrubbingSettings", "scrubIpAddresses") is not None
        assert safe.get_path(cfg, "config", "piiConfig", "rules") is None
        assert safe.get_path(cfg, "config", "piiConfig", "applications") is None

    def test_untrusted_external_relays_should_not_receive_configs(self):
        self._setup_relay(False, False)
        result, status_code = self._call_endpoint(full_config=False)

        assert status_code < 400

        cfg = result["configs"][six.text_type(self.project.id)]

        assert cfg is None
