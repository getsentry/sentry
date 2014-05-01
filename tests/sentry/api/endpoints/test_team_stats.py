from django.core.urlresolvers import reverse
from sentry.testutils import APITestCase


class TeamStatsTest(APITestCase):
    def test_simple(self):
        # TODO: ensure this test checks data
        self.login_as(user=self.user)

        team = self.create_team(owner=self.user)
        project_1 = self.create_project(team=team, name='a')  # NOQA
        project_2 = self.create_project(team=team, name='b')  # NOQA

        url = reverse('sentry-api-0-team-stats', kwargs={
            'team_id': team.id,
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
