from __future__ import absolute_import

from datetime import datetime
import pytz

from exam import fixture
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.models import RelayUsage


class OrganizationRelayHistoryTest(APITestCase):
    endpoint = "sentry-api-0-organization-relay-history"

    @fixture
    def user(self):
        return self.create_user("test@test.com")

    def _public_keys(self):
        return [
            "nDJl79SbEYH9-8NEJAI7ezrgYfolPW3Bnkg00k1zOfA",
            "AitWAgB-oHFywmKnUMRKMXcrsyPkESV-5gR-vsMqXgQ",
            "SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
        ]

    def _history_fixture(self):
        pks = self._public_keys()
        return [
            {
                "relay_id": "r1",
                "public_key": pks[0],
                "version": "1.1.1",
                "first_seen": datetime(2001, 1, 1, tzinfo=pytz.UTC),
                "last_seen": datetime(2001, 1, 2, tzinfo=pytz.UTC),
            },
            {
                "relay_id": "r1",
                "public_key": pks[0],
                "version": "1.1.2",
                "first_seen": datetime(2001, 2, 1, tzinfo=pytz.UTC),
                "last_seen": datetime(2001, 2, 2, tzinfo=pytz.UTC),
            },
            {
                "relay_id": "r2",
                "public_key": pks[1],
                "version": "1.1.1",
                "first_seen": datetime(2002, 1, 1, tzinfo=pytz.UTC),
                "last_seen": datetime(2002, 1, 1, tzinfo=pytz.UTC),
            },
            {
                "relay_id": "r3",
                "public_key": pks[2],
                "version": "1.1.1",
                "first_seen": datetime(2003, 1, 1, tzinfo=pytz.UTC),
                "last_seen": datetime(2003, 1, 1, tzinfo=pytz.UTC),
            },
        ]

    def setUp(self):
        for relay_data in self._history_fixture():
            RelayUsage.objects.create(**relay_data)

    @with_feature("organizations:relay")
    def _set_org_public_keys(self, public_keys):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-organization-details", args=[self.organization.slug])
        trusted_relays = [
            {"name": "n_{}".format(idx), "description": "d_{}".format(idx), "publicKey": pk}
            for idx, pk in enumerate(public_keys)
        ]

        data = {"trustedRelays": trusted_relays}
        resp = self.client.put(url, data=data)
        assert resp.status_code == 200

    @with_feature("organizations:relay")
    def test_no_valid_public_keys(self):
        """
        An organization with no valid public keys should return an
        empty history list
        """

        self.login_as(user=self.user)
        response = self.get_valid_response(self.organization.slug)
        assert response.data == []

    def test_endpoint_checks_feature_present(self):
        self.login_as(user=self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 403

    @with_feature("organizations:relay")
    def test_only_records_for_known_public_keys_are_returned(self):
        """
        Only the relay history for relays belonging to the origanization are
        returned.

        A relay "belongs" to an organization if the relay uses a public key
        registered to the organization.
        """
        self.login_as(user=self.user)
        pks = self._public_keys()
        self._set_org_public_keys([pks[0], pks[1]])
        response = self.get_valid_response(self.organization.slug)

        data = response.data

        # test that we get the expected number of records
        assert len(data) == 3

        r1_1 = [r for r in data if r["relayId"] == "r1" and r["version"] == "1.1.1"]
        r1_2 = [r for r in data if r["relayId"] == "r1" and r["version"] == "1.1.2"]
        r2 = [r for r in data if r["relayId"] == "r2"]

        assert len(r1_1) == 1
        assert len(r1_2) == 1
        assert len(r2) == 1
