from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import tsdb
from sentry.testutils import APITestCase


class TeamStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team(members=[self.user])
        project_1 = self.create_project(teams=[team], name="a")
        project_2 = self.create_project(teams=[team], name="b")
        team_2 = self.create_team(members=[self.user])
        project_3 = self.create_project(teams=[team_2], name="c")

        tsdb.incr(tsdb.models.project, project_1.id, count=3)
        tsdb.incr(tsdb.models.project, project_2.id, count=5)
        tsdb.incr(tsdb.models.project, project_3.id, count=10)

        url = reverse(
            "sentry-api-0-team-stats",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 8, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24
