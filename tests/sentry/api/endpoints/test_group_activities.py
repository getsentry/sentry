from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test
class GroupActivitiesEndpointTest(APITestCase):
    def test_endpoint_with_no_group_activities(self):
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/activities/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 1

    def test_endpoint_with_group_activities(self):
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        for i in range(0, 4):
            Activity.objects.create(
                group=group,
                project=group.project,
                type=ActivityType.NOTE.value,
                data={"text": "hello world"},
            )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/activities/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 5
