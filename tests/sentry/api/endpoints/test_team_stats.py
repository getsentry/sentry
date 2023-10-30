from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test(stable=True)
@freeze_time(before_now(days=1).replace(minute=10))
class TeamStatsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team(members=[self.user])
        project_1 = self.create_project(teams=[team], name="a")
        project_2 = self.create_project(teams=[team], name="b")
        team_2 = self.create_team(members=[self.user])
        project_3 = self.create_project(teams=[team_2], name="c")

        for project, count in ((project_1, 2), (project_2, 1), (project_3, 4)):
            for _ in range(count):
                self.store_event(
                    data={
                        "timestamp": iso_format(before_now(minutes=5)),
                    },
                    project_id=project.id,
                )

        url = reverse(
            "sentry-api-0-team-stats",
            kwargs={"organization_slug": team.organization.slug, "team_slug": team.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
