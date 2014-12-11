from django.core.urlresolvers import reverse

from sentry.app import tsdb
from sentry.testutils import APITestCase


class OrganizationStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        team = self.create_team(organization=org, name='foo')
        project_1 = self.create_project(team=team, name='a')
        project_2 = self.create_project(team=team, name='b')
        team_2 = self.create_team(organization=org, name='bar')
        project_3 = self.create_project(team=team_2, name='c')

        tsdb.incr(tsdb.models.project_total_received, project_1.id, count=3)
        tsdb.incr(tsdb.models.project_total_received, project_2.id, count=5)
        tsdb.incr(tsdb.models.project_total_received, project_3.id, count=10)

        url = reverse('sentry-api-0-organization-stats', kwargs={
            'organization_id': org.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 18, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
