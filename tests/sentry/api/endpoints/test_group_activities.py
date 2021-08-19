from sentry.models import Activity, GroupStatus
from sentry.testutils import APITestCase


class GroupActivitiesEndpointTest(APITestCase):
    def test_endpoint_with_no_group_activities(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 1

    def test_endpoint_with_group_activities(self):
        group = self.create_group(checksum="a" * 32, status=GroupStatus.UNRESOLVED)

        for i in range(0, 4):
            Activity.objects.create(
                group=group,
                project=group.project,
                type=Activity.NOTE,
                data={"text": "hello world"},
            )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 5
