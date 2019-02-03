from __future__ import absolute_import

import six

from exam import fixture

from sentry.models import Monitor
from sentry.testutils import APITestCase


class OrganizationProjectsTest(APITestCase):
    @fixture
    def org(self):
        return self.create_organization(owner=self.user, name='baz')

    @fixture
    def team(self):
        return self.create_team(organization=self.org, members=[self.user])

    @fixture
    def project(self):
        return self.create_project(teams=[self.team])

    @fixture
    def path(self):
        return u'/api/0/organizations/{}/monitors/'.format(self.org.slug)

    def check_valid_response(self, response, expected_monitors):
        assert response.status_code == 200, response.content
        assert [six.text_type(monitor.guid) for monitor in expected_monitors] == [
            six.text_type(monitor_resp['id']) for monitor_resp in response.data]

    def test_simple(self):
        self.login_as(user=self.user)

        monitor = Monitor.objects.create(
            project_id=self.project.id,
            organization_id=self.org.id,
            name='My Monitor',
        )
        with self.feature({'organizations:monitors': True}):
            response = self.client.get(self.path)
        self.check_valid_response(response, [monitor])
