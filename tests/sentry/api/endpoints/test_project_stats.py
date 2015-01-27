from django.core.urlresolvers import reverse

from sentry.app import tsdb
from sentry.testutils import APITestCase


class ProjectStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team(owner=self.user)

        project1 = self.create_project(team=team, name='foo')
        project2 = self.create_project(team=team, name='bar')

        tsdb.incr(tsdb.models.project, project1.id, count=3)
        tsdb.incr(tsdb.models.project, project2.id, count=5)

        url = reverse('sentry-api-0-project-stats', kwargs={
            'project_id': project1.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
