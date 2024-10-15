from typing import Any
from unittest import mock
from unittest.mock import patch

from rest_framework.exceptions import ErrorDetail

from sentry import tsdb
from sentry.issues.forecasts import generate_and_save_forecasts
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox, remove_group_from_inbox
from sentry.models.groupowner import GROUP_OWNER_TYPE, GroupOwner, GroupOwnerType
from sentry.models.release import Release
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import before_now
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel


class GroupDetailsTest(APITestCase, SnubaTestCase):
    def test_multiple_environments(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, "production")
        environment2 = Environment.get_or_create(group.project, "staging")

        url = f"/api/0/issues/{group.id}/"

        with mock.patch(
            "sentry.issues.endpoints.group_details.tsdb.backend.get_range",
            side_effect=tsdb.backend.get_range,
        ) as get_range:
            response = self.client.get(
                f"{url}?environment=production&environment=staging", format="json"
            )
            assert response.status_code == 200
            assert get_range.call_count == 2
            for args, kwargs in get_range.call_args_list:
                assert kwargs["environment_ids"] == [environment.id, environment2.id]

        response = self.client.get(f"{url}?environment=invalid", format="json")
        assert response.status_code == 404

    def test_with_first_last_release(self):
        self.login_as(user=self.user)
        first_release = {
            "firstEvent": before_now(minutes=3),
            "lastEvent": before_now(minutes=2, seconds=30),
        }
        last_release = {
            "firstEvent": before_now(minutes=1, seconds=30),
            "lastEvent": before_now(minutes=1),
        }

        for timestamp in first_release.values():
            self.store_event(
                data={"release": "1.0", "timestamp": timestamp.isoformat()},
                project_id=self.project.id,
            )
        self.store_event(
            data={"release": "1.1", "timestamp": before_now(minutes=2).isoformat()},
            project_id=self.project.id,
        )
        event = [
            self.store_event(
                data={"release": "1.0a", "timestamp": timestamp.isoformat()},
                project_id=self.project.id,
            )
            for timestamp in last_release.values()
        ][-1]
        group = event.group

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == str(group.id)
        release = response.data["firstRelease"]
        assert release["version"] == "1.0"
        for event, timestamp in first_release.items():
            assert release[event].ctime() == timestamp.ctime()
        release = response.data["lastRelease"]
        assert release["version"] == "1.0a"
        for event, timestamp in last_release.items():
            assert release[event].ctime() == timestamp.ctime()

    def test_first_last_only_one_tagstore(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={"release": "1.0", "timestamp": before_now(days=3).isoformat()},
            project_id=self.project.id,
        )
        self.store_event(
            data={"release": "1.1", "timestamp": before_now(minutes=3).isoformat()},
            project_id=self.project.id,
        )

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        with mock.patch("sentry.tagstore.backend.get_release_tags") as get_release_tags:
            response = self.client.get(url, format="json")
            assert response.status_code == 200
            assert get_release_tags.call_count == 1

    def test_first_release_only(self):
        self.login_as(user=self.user)

        first_event = before_now(days=3)

        self.store_event(
            data={"release": "1.0", "timestamp": first_event.isoformat()},
            project_id=self.project.id,
        )
        event = self.store_event(
            data={"release": "1.1", "timestamp": before_now(days=1).isoformat()},
            project_id=self.project.id,
        )
        # Forcibly remove one of the releases
        Release.objects.get(version="1.1").delete()

        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["firstRelease"]["version"] == "1.0"
        # only one event
        assert (
            response.data["firstRelease"]["firstEvent"]
            == response.data["firstRelease"]["lastEvent"]
        )
        assert response.data["firstRelease"]["firstEvent"].ctime() == first_event.ctime()
        assert response.data["lastRelease"] is None

    def test_group_expand_inbox(self):
        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": before_now(minutes=3).isoformat()},
            project_id=self.project.id,
        )
        group = event.group
        add_group_to_inbox(group, GroupInboxReason.NEW)

        url = f"/api/0/issues/{group.id}/?expand=inbox"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["inbox"] is not None
        assert response.data["inbox"]["reason"] == GroupInboxReason.NEW.value
        assert response.data["inbox"]["reason_details"] is None
        remove_group_from_inbox(event.group)
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["inbox"] is None

    def test_group_expand_owners(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group = event.group
        url = f"/api/0/issues/{group.id}/?expand=owners"

        self.login_as(user=self.user)
        # Test with no owner
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert response.data["owners"] is None

        # Test with owners
        GroupOwner.objects.create(
            group=event.group,
            project=event.project,
            organization=event.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["owners"] is not None
        assert len(response.data["owners"]) == 1
        assert response.data["owners"][0]["owner"] == f"user:{self.user.id}"
        assert response.data["owners"][0]["type"] == GROUP_OWNER_TYPE[GroupOwnerType.SUSPECT_COMMIT]

    def test_group_expand_forecasts(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={"timestamp": before_now(seconds=500).isoformat(), "fingerprint": ["group-1"]},
            project_id=self.project.id,
        )
        group = event.group
        generate_and_save_forecasts([group])

        url = f"/api/0/issues/{group.id}/?expand=forecast"

        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["forecast"] is not None
        assert response.data["forecast"]["data"] is not None
        assert response.data["forecast"]["date_added"] is not None

    def test_group_get_priority(self):
        self.login_as(user=self.user)
        group = self.create_group(
            project=self.project,
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.LOW,
        )

        url = f"/api/0/issues/{group.id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["priority"] == "low"
        assert response.data["priorityLockedAt"] is None

    def test_group_post_priority(self):
        self.login_as(user=self.user)
        group = self.create_group(
            project=self.project,
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.LOW,
        )
        url = f"/api/0/issues/{group.id}/"

        get_response_before = self.client.get(url, format="json")
        assert get_response_before.status_code == 200, get_response_before.content
        assert get_response_before.data["priority"] == "low"

        response = self.client.put(url, {"priority": "high"}, format="json")
        assert response.status_code == 200, response.content
        assert response.data["priority"] == "high"

        act_for_group = Activity.objects.get_activities_for_group(group=group, num=100)
        assert len(act_for_group) == 2
        assert act_for_group[0].type == ActivityType.SET_PRIORITY.value
        assert act_for_group[-1].type == ActivityType.FIRST_SEEN.value
        assert act_for_group[0].user_id == self.user.id
        assert act_for_group[0].data["priority"] == "high"

        get_response_after = self.client.get(url, format="json")
        assert get_response_after.status_code == 200, get_response_after.content
        assert get_response_after.data["priority"] == "high"
        assert get_response_after.data["priorityLockedAt"] is not None

    def test_assigned_to_unknown(self):
        self.login_as(user=self.user)
        event = self.store_event(
            data={"timestamp": before_now(minutes=3).isoformat()},
            project_id=self.project.id,
        )
        group = event.group
        url = f"/api/0/issues/{group.id}/"
        response = self.client.put(
            url, {"assignedTo": "admin@localhost", "status": "unresolved"}, format="json"
        )
        assert response.status_code == 200
        response = self.client.put(
            url, {"assignedTo": "user@doesnotexist.com", "status": "unresolved"}, format="json"
        )
        assert response.status_code == 400
        assert response.data == {
            "assignedTo": [
                ErrorDetail(
                    string="Could not parse actor. Format should be `type:id` where type is `team` or `user`.",
                    code="invalid",
                )
            ]
        }

    def test_collapse_stats_does_not_work(self):
        """
        'collapse' param should hide the stats data and not return anything in the response, but the impl
        doesn't seem to respect this param.

        include this test here in-case the endpoint behavior changes in the future.
        """
        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": before_now(minutes=3).isoformat()},
            project_id=self.project.id,
        )
        group = event.group

        url = f"/api/0/issues/{group.id}/"

        response = self.client.get(url, {"collapse": ["stats"]}, format="json")
        assert response.status_code == 200
        assert int(response.data["id"]) == event.group.id
        assert response.data["stats"]  # key shouldn't be present
        assert response.data["count"] is not None  # key shouldn't be present
        assert response.data["userCount"] is not None  # key shouldn't be present
        assert response.data["firstSeen"] is not None  # key shouldn't be present
        assert response.data["lastSeen"] is not None  # key shouldn't be present

    def test_issue_type_category(self):
        """Test that the issue's type and category is returned in the results"""

        self.login_as(user=self.user)

        event = self.store_event(
            data={"timestamp": before_now(minutes=3).isoformat()},
            project_id=self.project.id,
        )

        url = f"/api/0/issues/{event.group.id}/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200
        assert int(response.data["id"]) == event.group.id
        assert response.data["issueType"] == "error"
        assert response.data["issueCategory"] == "error"

    def test_delete_error_issue(self) -> Any:
        """Test that a user cannot delete a error issue"""
        self.login_as(user=self.user)
        group = self.create_group(status=GroupStatus.RESOLVED, project=self.project)
        url = f"/api/0/issues/{group.id}/"

        with patch(
            "sentry.api.helpers.group_index.delete.delete_groups_task.apply_async"
        ) as mock_apply_async:
            response = self.client.delete(url, format="json")
            mock_apply_async.assert_called_once()
            kwargs = mock_apply_async.call_args[1]
            assert kwargs["countdown"] == 3600
            assert response.status_code == 202
            # Since the task has not executed yet the group is pending deletion
            assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION

        # Undo some of what the previous endpoint call did
        group.update(status=GroupStatus.RESOLVED)
        with self.tasks():
            response = self.client.delete(url, format="json")
            assert response.status_code == 202
            assert not Group.objects.filter(id=group.id).exists()

    def test_delete_issue_platform_issue(self) -> Any:
        """Test that a user cannot delete an issue if issue platform deletion is not allowed"""
        self.login_as(user=self.user)

        group = self.create_group(
            status=GroupStatus.RESOLVED,
            project=self.project,
            type=PerformanceSlowDBQueryGroupType.type_id,
        )

        url = f"/api/0/issues/{group.id}/"
        response = self.client.delete(url, format="json")
        assert response.status_code == 400
        assert response.json() == ["Only error issues can be deleted."]

        # We are allowed to delete the groups with the feature flag enabled
        with Feature({"organizations:issue-platform-deletion": True}):
            with patch(
                "sentry.api.helpers.group_index.delete.delete_groups_task.apply_async"
            ) as mock_apply_async:
                response = self.client.delete(url, format="json")
                assert response.status_code == 202
                # Since the task has not executed yet the group is pending deletion
                assert Group.objects.get(id=group.id).status == GroupStatus.PENDING_DELETION
                mock_apply_async.assert_called_once()
                kwargs = mock_apply_async.call_args[1]
                # We don't wait to schedule the deletion of non-error issues
                assert kwargs["countdown"] == 0

        # Undo some of what the previous endpoint call did
        group.update(status=GroupStatus.RESOLVED)
        with Feature({"organizations:issue-platform-deletion": True}), self.tasks():
            response = self.client.delete(url, format="json")
            assert response.status_code == 202
            # Now check that the group doesn't exist
            assert not Group.objects.filter(id=group.id).exists()
