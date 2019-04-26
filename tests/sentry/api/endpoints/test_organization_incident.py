from __future__ import absolute_import

from exam import fixture

from sentry.api.serializers import serialize
from sentry.testutils import APITestCase


class IncidentListTest(APITestCase):
    endpoint = 'sentry-api-0-organization-incident-index'

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
        self.login_as(self.user)
        with self.feature('organizations:incidents'):
            resp = self.get_valid_response(self.organization.slug)
        assert resp.data == serialize([incident])

    def test__no_feature(self):
        self.create_team(organization=self.organization, members=[self.user])
        self.login_as(self.user)
        resp = self.get_response(self.organization.slug)
        assert resp.status_code == 404
