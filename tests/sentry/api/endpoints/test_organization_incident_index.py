from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.incidents.models import IncidentStatus
from sentry.testutils import APITestCase


class IncidentListEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-incident-index"

    @fixture
    def organization(self):
        return self.create_organization()

    @fixture
    def project(self):
        return self.create_project(organization=self.organization)

    @fixture
    def user(self):
        return self.create_user()

    def test_simple(self):
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        other_incident = self.create_incident(status=IncidentStatus.CLOSED.value)

        self.login_as(self.user)
        with self.feature("organizations:incidents"):
            resp = self.get_valid_response(self.organization.slug)

        assert resp.data == serialize([other_incident, incident])

    def test_filter_status(self):
        self.create_team(organization=self.organization, members=[self.user])
        incident = self.create_incident()
        closed_incident = self.create_incident(status=IncidentStatus.CLOSED.value)
        self.login_as(self.user)

        with self.feature("organizations:incidents"):
            resp_closed = self.get_valid_response(self.organization.slug, status="closed")
            resp_open = self.get_valid_response(self.organization.slug, status="open")

        assert len(resp_closed.data) == 1
        assert len(resp_open.data) == 1
        assert resp_closed.data == serialize([closed_incident])
        assert resp_open.data == serialize([incident])

    def test_no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404
