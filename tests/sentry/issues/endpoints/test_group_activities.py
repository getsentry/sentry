from datetime import timedelta

from django.utils import timezone

from sentry.issues.action_log.types import ActionSource, GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.pullrequest import PullRequestLifecycleState
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled
from sentry.types.activity import ActivityType


class GroupActivitiesEndpointTest(APITestCase):
    def test_expand_pull_requests(self) -> None:
        group = self.create_group()
        repository = self.create_repo(project=group.project)
        pull_request = self.create_pull_request(
            repository_id=repository.id,
            organization_id=group.organization.id,
            message=f"Fixes {group.qualified_short_id}",
        )
        pull_request.update(state=PullRequestLifecycleState.OPEN, draft=False)
        original = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        )
        self.create_group_activity(
            group=group, type=ActivityType.NOTE.value, data={"text": "Checking the fix"}
        )
        latest = self.create_group_activity(
            group=group,
            type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
            ident=str(pull_request.id),
            data={"pull_request": pull_request.id},
        )
        self.login_as(self.user)
        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"

        response = self.client.get(url)
        assert response.data["activity"][0]["data"]["pullRequestId"] == str(pull_request.id)
        assert "pullRequests" not in response.data

        response = self.client.get(url, {"expand": "pullRequests"})

        assert response.status_code == 200
        items = {item["id"]: item for item in response.data["activity"]}
        assert items[str(latest.id)]["data"]["pullRequestId"] == str(pull_request.id)
        assert items[str(original.id)]["data"]["pullRequestId"] == str(pull_request.id)
        assert "dateLinked" not in items[str(original.id)]["data"]["pullRequest"]
        assert list(response.data["pullRequests"]) == [str(pull_request.id)]
        assert response.data["pullRequests"][str(pull_request.id)]["status"] == "open"

    def test_expand_pull_request_outside_activity_window(self) -> None:
        group = self.create_group()
        repository = self.create_repo(project=group.project)
        pull_request = self.create_pull_request(
            repository_id=repository.id,
            organization_id=group.organization.id,
            message=f"Fixes {group.qualified_short_id}",
        )
        pull_request.update(state=PullRequestLifecycleState.MERGED)
        reference = Activity.objects.get(
            group=group, type=ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        )
        reference.update(datetime=timezone.now() - timedelta(days=1))
        for _ in range(100):
            self.create_group_activity(
                group=group, type=ActivityType.NOTE.value, data={"text": "A newer comment"}
            )
        self.login_as(self.user)
        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"

        default_response = self.client.get(url)
        assert str(reference.id) not in [item["id"] for item in default_response.data["activity"]]
        response = self.client.get(url, {"expand": "pullRequests"})

        assert response.status_code == 200
        assert response.data["activity"] == default_response.data["activity"]
        assert list(response.data["pullRequests"]) == [str(pull_request.id)]
        assert response.data["pullRequests"][str(pull_request.id)]["id"] == pull_request.key
        assert response.data["pullRequests"][str(pull_request.id)]["status"] == "merged"

    @action_log_activity_enabled()
    def test_expand_pull_requests_from_action_log(self) -> None:
        group = self.create_group()
        repository = self.create_repo(project=group.project)
        pull_request = self.create_pull_request(
            repository_id=repository.id,
            organization_id=group.organization.id,
            message=f"Fixes {group.qualified_short_id}",
        )
        pull_request.update(state=PullRequestLifecycleState.OPEN, draft=False)
        reference = GroupActionLogEntry.objects.get(
            group_id=group.id, type=GroupActionType.RESOLVED_IN_PULL_REQUEST.value
        )
        note = self.create_group_activity(
            group=group, type=ActivityType.NOTE.value, data={"text": "Keep me"}
        )
        self.login_as(self.user)
        url = f"/api/0/organizations/{group.organization.id}/issues/{group.id}/activities/"

        response = self.client.get(url, {"expand": "pullRequests"})

        assert response.status_code == 200
        references = [
            item
            for item in response.data["activity"]
            if item["type"] == "set_resolved_in_pull_request"
        ]
        assert len(references) == 1
        assert references[0]["id"] == str(reference.id)
        assert references[0]["data"]["pullRequestId"] == str(pull_request.id)
        assert response.data["pullRequests"][str(pull_request.id)]["status"] == "open"
        notes = [item for item in response.data["activity"] if item["type"] == "note"]
        assert len(notes) == 1
        assert notes[0]["commentId"] == str(note.id)
        assert notes[0]["data"]["text"] == "Keep me"

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
