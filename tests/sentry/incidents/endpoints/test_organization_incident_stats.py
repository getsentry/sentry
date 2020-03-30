from __future__ import absolute_import

from datetime import timedelta

from django.utils import timezone
from exam import fixture
from freezegun import freeze_time

from sentry.testutils import APITestCase


class OrganizationIncidentDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-stats"

    def setUp(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)

    @fixture
    def organization(self):
        return self.create_organization(owner=self.create_user())

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_no_perms(self):
        incident = self.create_incident()
        self.login_as(self.create_user())
        with self.feature("organizations:incidents"):
            resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 403

    def test_no_feature(self):
        incident = self.create_incident()
        resp = self.get_response(incident.organization.slug, incident.id)
        assert resp.status_code == 404

    @freeze_time()
    def test_simple(self):
        incident = self.create_incident(date_started=timezone.now() - timedelta(minutes=5))
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(incident.organization.slug, incident.identifier)

        assert resp.data["totalEvents"] == 0
        assert resp.data["uniqueUsers"] == 0
        assert [data[1] for data in resp.data["eventStats"]["data"]] == [[]] * 201
