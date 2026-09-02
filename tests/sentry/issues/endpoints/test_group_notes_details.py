from functools import cached_property
from unittest.mock import MagicMock, patch

import responses

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.action_log.types import GroupActionType
from sentry.issues.derived.gate import GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType


class GroupNotesDetailsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.activity.data["external_id"] = "123"
        self.activity.save()

        self.integration, org_integration = self.create_provider_integration_for(
            self.organization,
            user=None,
            provider="example",
            external_id="example12345",
            name="Example 12345",
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration.config = {"sync_comments": True}
            org_integration.save()

        self.external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="123"
        )
        GroupLink.objects.create(
            project_id=self.group.project_id,
            group_id=self.group.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=self.external_issue.id,
        )

    @cached_property
    def url(self) -> str:
        return f"/api/0/issues/{self.group.id}/comments/{self.activity.id}/"

    def test_delete_invalid_note_id(self) -> None:
        self.login_as(user=self.user)
        url = f"/api/0/issues/{self.group.id}/comments/abc/"
        response = self.client.delete(url, format="json")
        assert response.status_code == 404

    def test_put_invalid_note_id(self) -> None:
        self.login_as(user=self.user)
        url = f"/api/0/issues/{self.group.id}/comments/abc/"
        response = self.client.put(url, format="json", data={"text": "updated"})
        assert response.status_code == 404

    def test_delete(self) -> None:
        self.login_as(user=self.user)

        url = self.url

        assert Group.objects.get(id=self.group.id).num_comments == 1

        response = self.client.delete(url, format="json")
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

        assert Group.objects.get(id=self.group.id).num_comments == 0

    def test_delete_comment_and_subscription(self) -> None:
        """Test that if a user deletes their comment on an issue, we delete the subscription too"""
        self.login_as(user=self.user)
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group: Group = event.group

        # create a comment
        comment_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(comment_url, format="json", data={"text": "hi haters"})
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.filter(
            group=group,
            project=group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()
        activity = Activity.objects.get(
            group=group, type=ActivityType.NOTE.value, user_id=self.user.id
        )

        url = f"/api/0/issues/{group.id}/comments/{activity.id}/"
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.status_code
        assert not GroupSubscription.objects.filter(
            group=group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

    def test_delete_multiple_comments(self) -> None:
        """Test that if a user has commented multiple times on an issue and deletes one, we don't remove the subscription"""
        self.login_as(user=self.user)
        event = self.store_event(data={}, project_id=self.project.id)
        assert event.group is not None
        group: Group = event.group

        # create a comment
        comment_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(comment_url, format="json", data={"text": "hi haters"})
        assert response.status_code == 201, response.content
        assert GroupSubscription.objects.filter(
            group=group,
            project=group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

        # create another comment that we'll delete
        response = self.client.post(comment_url, format="json", data={"text": "bye haters"})
        assert response.status_code == 201, response.content

        activity = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=self.user.id
        )[0]

        url = f"/api/0/issues/{group.id}/comments/{activity.id}/"
        response = self.client.delete(url, format="json")

        assert response.status_code == 204, response.status_code
        assert GroupSubscription.objects.filter(
            group=group,
            project=self.group.project,
            user_id=self.user.id,
            reason=GroupSubscriptionReason.comment,
        ).exists()

    @patch("sentry.integrations.mixins.issues.IssueBasicIntegration.update_comment")
    @responses.activate
    def test_put(self, mock_update_comment: MagicMock) -> None:
        self.login_as(user=self.user)

        url = self.url

        response = self.client.put(url, format="json")
        assert response.status_code == 400, response.content

        with self.tasks():
            with self.feature("organizations:integrations-issue-sync"):
                response = self.client.put(url, format="json", data={"text": "hi haters"})
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters", "external_id": "123"}

        assert mock_update_comment.call_count == 1
        assert mock_update_comment.call_args[0][0] == "123"
        assert mock_update_comment.call_args[0][1] == self.user.id
        assert mock_update_comment.call_args[0][2] == activity

    @responses.activate
    def test_put_ignore_mentions(self) -> None:
        GroupLink.objects.filter(group_id=self.group.id).delete()
        self.login_as(user=self.user)

        with self.tasks():
            with self.feature("organizations:integrations-issue-sync"):
                response = self.client.put(
                    self.url,
                    format="json",
                    data={
                        "text": f"hi **@{self.user.username}**",
                        "mentions": [f"user:{self.user.id}"],
                    },
                )
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {
            "external_id": "123",
            "text": f"hi **@{self.user.username}**",
        }

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_put_returns_gale(self) -> None:
        self.login_as(user=self.user)
        group = self.group
        group.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        # create a comment that dual writes to GALE
        post_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(post_url, format="json", data={"text": "original"})
        assert response.status_code == 201, response.content
        activity_id = response.data["data"]["comment_id"]

        put_url = f"/api/0/issues/{group.id}/comments/{activity_id}/"
        response = self.client.put(put_url, format="json", data={"text": "updated text"})
        assert response.status_code == 200, response.content

        GroupActionLogEntry.objects.get(
            group_id=group.id,
            type=GroupActionType.COMMENT.value,
            data__comment_id=activity_id,
        )
        # `id` is the Activity id (comment_id), matching the flag-off contract
        assert response.data["id"] == str(activity_id)
        assert response.data["type"] == "note"
        assert response.data["user"]["id"] == str(self.user.id)
        # the fresh text is re-derived from the edited activity, not the stale GALE entry
        assert response.data["data"]["text"] == "updated text"
        assert response.data["data"]["comment_id"] == activity_id

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_put_writes_comment_edit_entry(self) -> None:
        self.login_as(user=self.user)
        group = self.group
        group.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        post_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(post_url, format="json", data={"text": "original"})
        assert response.status_code == 201, response.content
        activity_id = response.data["data"]["comment_id"]

        original_entry = GroupActionLogEntry.objects.get(
            group_id=group.id,
            type=GroupActionType.COMMENT.value,
            data__comment_id=activity_id,
        )

        put_url = f"/api/0/issues/{group.id}/comments/{activity_id}/"
        response = self.client.put(put_url, format="json", data={"text": "updated text"})
        assert response.status_code == 200, response.content

        edit_entry = GroupActionLogEntry.objects.get(
            group_id=group.id, type=GroupActionType.COMMENT_EDIT.value
        )
        # the edit references the original COMMENT entry by its GALE id and carries the new text
        assert edit_entry.data["comment_id"] == original_entry.id
        assert edit_entry.data["text"] == "updated text"

        # the original COMMENT entry is left untouched
        original_entry.refresh_from_db()
        assert original_entry.data["text"] == "original"

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_delete_writes_comment_delete_entry(self) -> None:
        self.login_as(user=self.user)
        group = self.group
        group.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        post_url = f"/api/0/issues/{group.id}/comments/"
        response = self.client.post(post_url, format="json", data={"text": "original"})
        assert response.status_code == 201, response.content
        activity_id = response.data["data"]["comment_id"]

        original_entry = GroupActionLogEntry.objects.get(
            group_id=group.id,
            type=GroupActionType.COMMENT.value,
            data__comment_id=activity_id,
        )

        delete_url = f"/api/0/issues/{group.id}/comments/{activity_id}/"
        response = self.client.delete(delete_url, format="json")
        assert response.status_code == 204, response.status_code

        delete_entry = GroupActionLogEntry.objects.get(
            group_id=group.id, type=GroupActionType.COMMENT_DELETE.value
        )
        # the tombstone references the original COMMENT entry by its GALE id, the
        # same way COMMENT_EDIT entries do, so it can be joined to the COMMENT row
        assert delete_entry.data["comment_id"] == original_entry.id

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_put_returns_404_without_gale_entry(self) -> None:
        # backfilled project, so GALE is authoritative for existence: a missing
        # entry means the note is already gone and we 404 instead of editing
        # the Activity.
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)

        response = self.client.put(self.url, format="json", data={"text": "updated"})
        assert response.status_code == 404, response.content

        assert not GroupActionLogEntry.objects.filter(
            group_id=self.group.id, type=GroupActionType.COMMENT_EDIT.value
        ).exists()

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_put_without_gale_entry_not_backfilled(self) -> None:
        # activity flag on but the backfill hasn't finished, so GALE can't be
        # authoritative for existence: an Activity that predates the rollout has
        # no mirror GALE yet, and must still edit and return 200 rather than 404.
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)

        response = self.client.put(self.url, format="json", data={"text": "updated"})
        assert response.status_code == 200, response.content

        assert response.data["id"] == str(self.activity.id)
        assert response.data["data"]["text"] == "updated"

    @with_feature(["projects:issue-action-log-write-to-db", "projects:issue-action-log-activity"])
    def test_delete_without_gale_entry_not_backfilled(self) -> None:
        # same as above for DELETE: without a complete log we fall back to the
        # Activity rather than treating a missing GALE entry as "already gone".
        self.login_as(user=self.user)

        response = self.client.delete(self.url, format="json")
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

    @with_feature("projects:issue-action-log-write-to-db")
    def test_put_without_gale_entry_write_only(self) -> None:
        # write flag on but activity flag off: the write flag must not change
        # the response contract, so a PUT against an Activity that predates the
        # rollout (no mirror GALE) still edits the Activity and returns 200.
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)

        response = self.client.put(self.url, format="json", data={"text": "updated"})
        assert response.status_code == 200, response.content

        assert response.data["id"] == str(self.activity.id)
        assert response.data["data"]["text"] == "updated"

    @with_feature("projects:issue-action-log-write-to-db")
    def test_delete_without_gale_entry_write_only(self) -> None:
        # write flag on but activity flag off: the write flag must not change
        # the response contract, so a DELETE against an Activity that predates
        # the rollout (no mirror GALE) still deletes the Activity and returns
        # 204.
        self.login_as(user=self.user)

        response = self.client.delete(self.url, format="json")
        assert response.status_code == 204, response.status_code
        assert not Activity.objects.filter(id=self.activity.id).exists()

    @patch("sentry.integrations.mixins.issues.IssueBasicIntegration.update_comment")
    def test_put_no_external_id(self, mock_update_comment: MagicMock) -> None:
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)

        url = self.url

        response = self.client.put(url, format="json")
        assert response.status_code == 400, response.content

        response = self.client.put(url, format="json", data={"text": "hi haters"})
        assert response.status_code == 200, response.content

        activity = Activity.objects.get(id=response.data["id"])
        assert activity.user_id == self.user.id
        assert activity.group == self.group
        assert activity.data == {"text": "hi haters"}

        assert mock_update_comment.call_count == 0
