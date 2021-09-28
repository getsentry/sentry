
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now

from sentry.models import GroupHistory, GroupHistoryStatus

class TeamTimeToResolutionTest(APITestCase):
    def test_simple(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(checksum="a" * 32, project=project1, times_seen=10)
        group2 = self.create_group(checksum="b" * 32, project=project2, times_seen=5)

        gh1 = GroupHistory.objects.create(
            group=group1,
            project=project1,
            actor=self.user.actor,

            date_added=before_now(days=5),
            status=GroupHistoryStatus.UNRESOLVED,
            prev_history=None,
            prev_history_date=None,
        )

        GroupHistory.objects.create(
            group=group1,
            project=project1,
            actor=self.user.actor,

            status=GroupHistoryStatus.RESOLVED,
            prev_history=gh1,
            prev_history_date=gh1.date_added,
        )

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/time-to-solution/"
        response = self.client.get(url, format="json")
        print("response:",response)
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(group1.id)
        assert response.data[1]["id"] == str(group2.id)
