from sentry.issues.action_log.types import ActionSource, GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled
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

    @action_log_activity_enabled()
    def test_endpoint_with_group_action_log_entries(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED)
        self.create_group_action_log_entry(
            group=group,
            type=GroupActionType.CREATE_PLATFORM_EXTERNAL_ISSUE,
            data={
                "service_type": "example",
                "display_name": "APP-42",
                "web_url": "https://example.com/42",
            },
        )

        with self.feature({"projects:issue-action-log-write-to-db": False}):
            note = self.create_group_activity(
                group=group, type=ActivityType.NOTE.value, data={"text": "no GAL event"}
            )

        for i in range(0, 4):
            GroupActionLogEntry.objects.create(
                group_id=group.id,
                project_id=group.project_id,
                type=GroupActionType.RESOLVE.value,
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
        assert len(response.data["activity"]) == 6
        notes = [item for item in response.data["activity"] if item["type"] == "note"]
        assert len(notes) == 1
        assert notes[0]["id"] == notes[0]["commentId"] == str(note.id)
        assert notes[0]["data"]["text"] == "no GAL event"
        assert notes[0]["source"] is None
