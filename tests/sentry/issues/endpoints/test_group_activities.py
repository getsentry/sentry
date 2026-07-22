from sentry.issues.action_log.types import ActionSource, GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class GroupActivitiesEndpointTest(APITestCase):
    def test_endpoint_with_no_group_activities(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        self.login_as(user=self.user)

        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 1

    def test_endpoint_with_group_activities(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        for i in range(0, 4):
            Activity.objects.create(
                group=group,
                project=group.project,
                type=ActivityType.NOTE.value,
                data={"text": "hello world"},
            )

        self.login_as(user=self.user)

        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 5

    @with_feature("projects:issue-action-log-activity")
    def test_endpoint_with_group_action_log_entries(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)

        for i in range(0, 4):
            GroupActionLogEntry.objects.create(
                group_id=group.id,
                project_id=group.project_id,
                type=GroupActionType.COMMENT_EDIT.value,
                actor_type=GroupActorType.SYSTEM,
                actor_id=0,
                source=ActionSource.API,
                data={},
            )

        self.login_as(user=self.user)

        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"
        response = self.client.get(
            url,
            format="json",
        )

        assert "activity" in response.data
        assert len(response.data["activity"]) == 5
