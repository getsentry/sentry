from django.core.urlresolvers import reverse

from sentry.app import tsdb
from sentry.testutils import APITestCase


class TeamStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team(owner=self.user, name='foo')
        project_1 = self.create_project(team=team, name='a')
        project_2 = self.create_project(team=team, name='b')
        team_2 = self.create_team(owner=self.user, name='bar')
        project_3 = self.create_project(team=team_2, name='c')

        tsdb.incr(tsdb.models.project, project_1.id, count=3)
        tsdb.incr(tsdb.models.project, project_2.id, count=5)
        tsdb.incr(tsdb.models.project, project_3.id, count=10)

        url = reverse('sentry-api-0-team-stats', kwargs={
            'team_id': team.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 8, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
