from functools import cached_property
from typing import cast
from unittest.mock import MagicMock, patch

import responses

from sentry.api.serializers.models.groupactionlogentry import get_serialized_activity_items
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.issues.action_log.types import GroupActionLogPayload, GroupActionType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.receivers.outbox.cell import process_group_action_log_event
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType


# The default Activity fixture represents a comment created before GALE dual writes.
@with_feature({"projects:issue-action-log-write-to-db": False})
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

    def test_mutation_outbox_failure_rolls_back(self) -> None:
        self.login_as(user=self.user)
        note = self.activity
        group = self.group
        original_data = dict(note.data)
        group.refresh_from_db()
        initial_count = group.num_comments
        self.create_group_action_log_entry(
            type=GroupActionType.COMMENT,
            data={"comment_id": note.id, "text": note.data.get("text")},
            idempotency_key=f"activity:{note.id}",
        )
        GroupSubscription.objects.subscribe(
            group=group, subscriber=self.user, reason=GroupSubscriptionReason.comment
        )
        for method in (self.client.put, self.client.delete):
            with (
                self.feature("projects:issue-action-log-write-to-db"),
                patch(
                    "sentry.issues.models.groupactionlogoutbox.GroupActionLogOutbox.save",
                    side_effect=RuntimeError("enqueue failed"),
                ),
                patch("sentry.issues.comments._sync_comment") as sync,
                patch("sentry.issues.comments.comment_updated.send_robust") as updated,
                patch("sentry.issues.comments.comment_deleted.send_robust") as deleted,
                self.captureOnCommitCallbacks(execute=True),
            ):
                response = method(self.url, data={"text": "rollback"}, format="json")
                assert response.status_code == 500
            note.refresh_from_db()
            group.refresh_from_db()
            assert note.data == original_data
            assert group.num_comments == initial_count
            assert GroupSubscription.objects.filter(group=group, user_id=self.user.id).exists()
            sync.assert_not_called()
            updated.assert_not_called()
            deleted.assert_not_called()

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
        self.organization.update_option("sentry:events_member_admin", False)
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.activity.update(user_id=member.id)
        token = self.create_user_auth_token(user=member, scope_list=["event:write"])

        assert Group.objects.get(id=self.group.id).num_comments == 1

        with patch(
            "sentry.issues.endpoints.group_notes_details.record_activity_read"
        ) as record_read:
            response = self.client.delete(self.url, HTTP_AUTHORIZATION=f"Bearer {token.token}")
        assert response.status_code == 204, response.status_code
        record_read.assert_not_called()
        assert not Activity.objects.filter(id=self.activity.id).exists()

        assert Group.objects.get(id=self.group.id).num_comments == 0

    def test_delete_with_read_only_token(self) -> None:
        token = self.create_user_auth_token(user=self.user, scope_list=["event:read"])

        response = self.client.delete(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )

        assert response.status_code == 403, response.content
        assert Activity.objects.filter(id=self.activity.id).exists()

    def test_delete_another_users_comment_with_write_token(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        token = self.create_user_auth_token(user=member, scope_list=["event:write"])

        response = self.client.delete(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {token.token}"
        )

        assert response.status_code == 404, response.content
        assert Activity.objects.filter(id=self.activity.id).exists()

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
        assert response.data["commentId"] == str(activity.id)
        assert response.data["source"] is None
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

    @action_log_activity_enabled()
    def test_delayed_and_retried_events_cannot_restore_deleted_comment(self) -> None:
        self.login_as(user=self.user)
        group = self.group
        post_url = f"/api/0/issues/{group.id}/comments/"
        with outbox_context(flush=False):
            response = self.client.post(post_url, data={"text": "original"}, format="json")
            assert response.status_code == 201
            comment_id = int(response.data["commentId"])
            assert response.data["id"] == str(comment_id)
            assert response.data["source"] is None
            url = f"{post_url}{comment_id}/"
            assert (
                self.client.put(url, data={"text": "edited once"}, format="json").status_code == 200
            )
            assert (
                self.client.put(url, data={"text": "edited twice"}, format="json").status_code
                == 200
            )
            assert self.client.delete(url, format="json").status_code == 204
        payloads = cast(
            list[GroupActionLogPayload],
            list(
                GroupActionLogOutbox.objects.filter(shard_identifier=group.id)
                .order_by("id")
                .values_list("payload", flat=True)
            ),
        )
        assert [p["type"] for p in payloads] == [
            GroupActionType.COMMENT,
            GroupActionType.COMMENT_EDIT,
            GroupActionType.COMMENT_EDIT,
            GroupActionType.COMMENT_DELETE,
        ]
        assert payloads[0]["idempotency_key"] == f"activity:{comment_id}"
        keys = [p["idempotency_key"] for p in payloads[1:]]
        assert len(set(keys)) == 3
        assert [payload["data"] for payload in payloads] == [
            {"comment_id": comment_id, "text": None, "mentions": None},
            {
                "comment_id": comment_id,
                "comment_id_kind": "comment",
                "text": None,
                "mentions": None,
            },
            {
                "comment_id": comment_id,
                "comment_id_kind": "comment",
                "text": None,
                "mentions": None,
            },
            {"comment_id": comment_id, "comment_id_kind": "comment"},
        ]
        for payload in reversed(payloads):
            assert payload["actor_id"] == self.user.id
            process_group_action_log_event(payload)
            process_group_action_log_event(payload)
        assert GroupActionLogEntry.objects.filter(group_id=group.id).count() == 4
        items = get_serialized_activity_items(group, self.user, endpoint="test")
        assert items is not None
        assert str(comment_id) not in [item["commentId"] for item in items]
        assert not Activity.objects.filter(id=comment_id).exists()

    @action_log_activity_enabled()
    def test_put_returns_activity_and_appends_event(self) -> None:
        self.login_as(user=self.user)
        post_url = f"/api/0/issues/{self.group.id}/comments/"
        response = self.client.post(post_url, format="json", data={"text": "original"})
        assert response.status_code == 201
        comment_id = response.data["commentId"]
        created = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT
        )
        original_payload = dict(created.data)
        response = self.client.put(
            f"{post_url}{comment_id}/",
            format="json",
            data={"text": "updated text", "mentions": [f"user:{self.user.id}"]},
        )
        assert response.status_code == 200
        assert response.data["id"] == response.data["commentId"] == comment_id
        assert response.data["data"]["text"] == "updated text"
        assert response.data["data"]["comment_id"] == int(comment_id)
        assert response.data["source"] == created.source
        edit = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT_EDIT
        )
        assert edit.data == {
            "comment_id": int(comment_id),
            "comment_id_kind": "comment",
            "text": None,
            "mentions": None,
        }
        created.refresh_from_db()
        assert created.data == original_payload

    def test_edit_and_delete_legacy_comment(self) -> None:
        self._assert_edit_and_delete_legacy_comment(True)

    def test_edit_and_delete_legacy_comment_without_gal_serving(self) -> None:
        self._assert_edit_and_delete_legacy_comment(False)

    def _assert_edit_and_delete_legacy_comment(self, serve_from_log: bool) -> None:
        self.login_as(user=self.user)
        note = self.create_group_activity(
            type=ActivityType.NOTE.value, user_id=self.user.id, data={"text": "original"}
        )
        created = self.create_group_action_log_entry(
            # Keep GAL and Activity IDs different to catch accidental substitution.
            id=note.id + 1000,
            type=GroupActionType.COMMENT,
            data={"comment_id": note.id, "text": "historical", "mentions": []},
            idempotency_key=f"activity:{note.id}",
            source="api",
        )
        url = f"/api/0/issues/{self.group.id}/comments/{note.id}/"
        with (
            action_log_activity_enabled(),
            self.feature({"projects:issue-action-log-activity": serve_from_log}),
        ):
            response = self.client.put(url, data={"text": "updated"}, format="json")
            assert response.status_code == 200, response.content
            assert response.data["id"] == response.data["commentId"] == str(note.id)
            assert response.data["type"] == "note"
            assert response.data["data"]["text"] == "updated"
            assert response.data["source"] == "api"
            note.refresh_from_db()
            assert note.data["text"] == "updated"

            response = self.client.delete(url, format="json")
            assert response.status_code == 204, response.content
        assert not Activity.objects.filter(id=note.id).exists()
        edit = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT_EDIT
        )
        deletion = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT_DELETE
        )
        expected = {"comment_id": note.id, "comment_id_kind": "comment"}
        assert edit.data == {**expected, "text": None, "mentions": None}
        assert deletion.data == expected
        created.refresh_from_db()
        assert created.data == {"comment_id": note.id, "text": "historical", "mentions": []}

    @action_log_activity_enabled()
    def test_edit_and_delete_without_original_gale_entry(self) -> None:
        del self.activity.data["external_id"]
        self.activity.save()
        self.login_as(user=self.user)
        response = self.client.put(self.url, format="json", data={"text": "updated"})
        assert response.status_code == 200
        assert response.data["id"] == response.data["commentId"] == str(self.activity.id)
        assert response.data["data"]["text"] == "updated"
        assert response.data["source"] is None
        edit = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT_EDIT
        )
        assert edit.data == {
            "comment_id": self.activity.id,
            "comment_id_kind": "comment",
            "text": None,
            "mentions": None,
        }

        response = self.client.delete(self.url, format="json")
        assert response.status_code == 204
        assert not Activity.objects.filter(id=self.activity.id).exists()
        deleted = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=GroupActionType.COMMENT_DELETE
        )
        assert deleted.data == {"comment_id": self.activity.id, "comment_id_kind": "comment"}

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
        assert response.data["commentId"] == str(self.activity.id)
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
