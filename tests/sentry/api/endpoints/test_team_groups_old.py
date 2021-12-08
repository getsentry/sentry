from datetime import datetime

from django.utils import timezone

from sentry.testutils import APITestCase


class TeamGroupsOldTest(APITestCase):
    def test_simple(self):
        project1 = self.create_project(teams=[self.team], slug="foo")
        project2 = self.create_project(teams=[self.team], slug="bar")
        group1 = self.create_group(
            checksum="a" * 32,
            project=project1,
            first_seen=datetime(2018, 1, 12, 3, 8, 25, tzinfo=timezone.utc),
        )
        group2 = self.create_group(
            checksum="b" * 32,
            project=project2,
            first_seen=datetime(2015, 1, 12, 3, 8, 25, tzinfo=timezone.utc),
        )

        self.login_as(user=self.user)
        url = f"/api/0/teams/{self.team.organization.slug}/{self.team.slug}/issues/old/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]["id"] == str(group2.id)
        assert response.data[1]["id"] == str(group1.id)
