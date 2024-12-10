from unittest.mock import patch

import orjson
from django.db import router
from django.urls import reverse
from slack_sdk.errors import SlackApiError
from slack_sdk.models.views import View
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.integrations.slack.webhooks.action import (
    ARCHIVE_OPTIONS,
    LINK_IDENTITY_MESSAGE,
    UNLINK_IDENTITY_MESSAGE,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.release import Release
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import PerformanceIssueTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.group import GroupSubStatus
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri
from sentry.utils.samples import load_data

from . import BaseEventTest

pytestmark = [requires_snuba]


class StatusActionTest(BaseEventTest, PerformanceIssueTestCase, HybridCloudTestMixin):
    def setUp(self):
        super().setUp()
        self.notification_text = "Identity not found."
        self.event_data = {
            "event_id": "a" * 32,
            "message": "IntegrationError",
            "fingerprint": ["group-1"],
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": self.notification_text,
                    }
                ]
            },
        }
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        assert event.group
        self.group = Group.objects.get(id=event.group.id)
        self.tags = {"escape", "foo", "release"}

    def get_original_message(self, group_id):
        return {
            "blocks": [
                {
                    "type": "section",
                    "block_id": orjson.dumps({"issue": group_id}).decode(),
                    "text": {"type": "mrkdwn", "text": "boop", "verbatim": False},
                },
                {
                    "block_id": orjson.dumps({"issue": group_id, "block": "tags"}).decode(),
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "escape: `room`  foo: `bar baz`  release: `<http://testserver/releases/57c9bf0a3e183536ef9d47842e932a9e571b6d04/|57c9bf0a3e18>`  ",
                    },
                },
            ],
        }

    def get_unfurl_data(self, blocks):
        return {
            "container": {
                "type": "message_attachment",
                "is_app_unfurl": True,
                "app_unfurl_url": "http://testserver/organizations/foo/issues/1?project=1&amp;referrer=slack",
            },
            "app_unfurl": {
                "id": 1,
                "blocks": blocks,
                "app_unfurl_url": "http://testserver/organizations/foo/issues/1?project=1&amp;referrer=slack",
                "is_app_unfurl": True,
            },
        }

    def get_archive_status_action(self):
        return {
            "action_id": "archive_dialog",
            "block_id": "bXwil",
            "text": {"type": "plain_text", "text": "Archive", "emoji": True},
            "value": "archive_dialog",
            "type": "button",
            "action_ts": "1702424387.108033",
        }

    def get_assign_status_action(self, type, text, id):
        return {
            "type": "external_select",
            "action_id": "assign",
            "block_id": "qBjgd",
            "selected_option": {
                "text": {"type": "plain_text", "text": text, "emoji": True},
                "value": f"{type}:{id}",
            },
            "placeholder": {"type": "plain_text", "text": "Select Assignee...", "emoji": True},
            "action_ts": "1702499909.524144",
        }

    def get_resolve_status_action(self):
        return {
            "action_id": "resolve_dialog",
            "block_id": "AeGRw",
            "text": {"type": "plain_text", "text": "Resolve", "emoji": True},
            "value": "resolve_dialog",
            "type": "button",
            "action_ts": "1702502121.403007",
        }

    def get_mark_ongoing_action(self):
        return {
            "action_id": "unresolved:ongoing",
            "block_id": "xPlAm",
            "text": {"type": "plain_text", "text": "Mark as Ongoing", "emoji": True},
            "value": "unresolved:ongoing",
            "type": "button",
            "action_ts": "1702502122.304116",
        }

    def archive_issue(self, original_message, selected_option, payload_data=None):
        assert selected_option in ARCHIVE_OPTIONS.values()
        status_action = self.get_archive_status_action()

        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message, data=payload_data
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = self._mock_view_update.call_args.kwargs["external_id"]
        view: View = self._mock_view_update.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]

        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        resp = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option=selected_option,
        )

        assert resp.status_code == 200, resp.content
        return resp

    def assign_issue(self, original_message, selected_option, payload_data=None):
        if isinstance(selected_option, Team):
            status_action = self.get_assign_status_action(
                "team", selected_option.slug, selected_option.id
            )
        else:
            status_action = self.get_assign_status_action(
                "user", selected_option.get_display_name(), selected_option.id
            )
        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message
        )

        assert resp.status_code == 200, resp.content
        # Unlike the other action helper functions, this doesn't involve opening and submitting a
        # a modal so we don't use the responses wrapper on the assignment tests; we need to return
        # resp so that the tests can assert the response blocks looked as expected
        return resp

    def resolve_issue(self, original_message, selected_option, payload_data=None, mock_record=None):
        status_action = self.get_resolve_status_action()
        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message, data=payload_data
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = self._mock_view_update.call_args.kwargs["external_id"]
        view: View = self._mock_view_update.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        resp = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option=selected_option,
        )

        assert resp.status_code == 200, resp.content

        # 4 lifecycle events are recorded: 2 for the view submission and 2 for the view update
        if mock_record:
            assert len(mock_record.mock_calls) == 4
            start_1, success_1, start_2, success_2 = mock_record.mock_calls
            assert start_1.args[0] == EventLifecycleOutcome.STARTED
            assert success_1.args[0] == EventLifecycleOutcome.SUCCESS
            assert start_2.args[0] == EventLifecycleOutcome.STARTED
            assert success_2.args[0] == EventLifecycleOutcome.SUCCESS

    @freeze_time("2021-01-14T12:27:28.303Z")
    def test_ask_linking(self):
        """Freezing time to prevent flakiness from timestamp mismatch."""

        resp = self.post_webhook(slack_user={"id": "invalid-id", "domain": "example"})
        associate_url = build_linking_url(
            self.integration, "invalid-id", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["response_type"] == "ephemeral"
        assert resp.data["text"] == LINK_IDENTITY_MESSAGE.format(associate_url=associate_url)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_until_escalating(self, mock_tags, mock_record):
        original_message = self.get_original_message(self.group.id)
        self.archive_issue(original_message, "ignored:archived_until_escalating")

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_ESCALATING

        blocks = self.mock_post.call_args.kwargs["blocks"]

        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)
        assert "via" not in blocks[4]["elements"][0]["text"]
        assert ":white_circle:" in blocks[0]["text"]["text"]

        assert len(mock_record.mock_calls) == 4
        start_1, success_1, start_2, success_2 = mock_record.mock_calls
        assert start_1.args[0] == EventLifecycleOutcome.STARTED
        assert success_1.args[0] == EventLifecycleOutcome.SUCCESS
        assert start_2.args[0] == EventLifecycleOutcome.STARTED
        assert success_2.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_until_escalating_through_unfurl(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.archive_issue(original_message, "ignored:archived_until_escalating", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_ESCALATING

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_until_condition_met(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        self.archive_issue(original_message, "ignored:archived_until_condition_met:10")

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_CONDITION_MET
        group_snooze = GroupSnooze.objects.get(group=self.group)
        assert group_snooze.count == 10

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_until_condition_met_through_unfurl(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.archive_issue(
            original_message, "ignored:archived_until_condition_met:100", payload_data
        )

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_CONDITION_MET
        group_snooze = GroupSnooze.objects.get(group=self.group)
        assert group_snooze.count == 100

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_forever(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        self.archive_issue(original_message, "ignored:archived_forever")

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.models.organization.Organization.has_access", return_value=False)
    def test_archive_issue_forever_error(self, mock_access):
        original_message = self.get_original_message(self.group.id)

        resp = self.archive_issue(original_message, "ignored:archived_forever")
        expected_text = f"Looks like this Slack identity is linked to the Sentry user *{self.user.email}* who is not a member of organization *{self.organization.slug}* used with this Slack integration. "
        assert expected_text in resp.data["text"]
        assert resp.data["response_type"] == "ephemeral"
        assert resp.data["replace_original"] is False

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.UNRESOLVED
        assert self.group.substatus == GroupSubStatus.NEW

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_archive_issue_forever_through_unfurl(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.archive_issue(original_message, "ignored:archived_forever", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    def test_archive_issue_with_additional_user_auth(self):
        """
        Ensure that we can act as a user even when the organization has SSO enabled
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth_idp = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
            AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)

        original_message = self.get_original_message(self.group.id)
        self.archive_issue(original_message, "ignored:archived_forever")

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        blocks = self.mock_post.call_args.kwargs["blocks"]

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    def test_archive_issue_with_additional_user_auth_through_unfurl(self):
        """
        Ensure that we can act as a user even when the organization has SSO enabled
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth_idp = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
            AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.archive_issue(original_message, "ignored:archived_forever", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        blocks = self.mock_post.call_args.kwargs["blocks"]

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_unarchive_issue(self, mock_tags):
        self.group.status = GroupStatus.IGNORED
        self.group.substatus = GroupSubStatus.UNTIL_ESCALATING
        self.group.save(update_fields=["status", "substatus"])

        status_action = self.get_mark_ongoing_action()
        original_message = self.get_original_message(self.group.id)

        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message
        )
        assert resp.status_code == 200, resp.content

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.UNRESOLVED
        assert self.group.substatus == GroupSubStatus.NEW  # the issue is less than 7 days old

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue re-opened by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_unarchive_issue_through_unfurl(self, mock_tags):
        self.group.status = GroupStatus.IGNORED
        self.group.substatus = GroupSubStatus.UNTIL_ESCALATING
        self.group.save(update_fields=["status", "substatus"])

        status_action = self.get_mark_ongoing_action()
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])

        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message, data=payload_data
        )
        assert resp.status_code == 200, resp.content

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.UNRESOLVED
        assert self.group.substatus == GroupSubStatus.NEW  # the issue is less than 7 days old

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue re-opened by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_assign_issue(self, mock_tags):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        original_message = self.get_original_message(self.group.id)

        # Assign to user
        self.assign_issue(original_message, user2)
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = f"*Issue assigned to {user2.get_display_name()} by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text
        assert ":white_circle:" in blocks[0]["text"]["text"]

        # Assign to team
        self.assign_issue(original_message, self.team)
        assert GroupAssignee.objects.filter(group=self.group, team=self.team).exists()
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = f"*Issue assigned to #{self.team.slug} by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text
        assert ":white_circle:" in blocks[0]["text"]["text"]

        # Assert group assignment activity recorded
        group_activity = list(Activity.objects.filter(group=self.group))
        assert group_activity[0].data == {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.SLACK.value,
        }
        assert group_activity[-1].data == {
            "assignee": str(self.team.id),
            "assigneeEmail": None,
            "assigneeType": "team",
            "integration": ActivityIntegration.SLACK.value,
        }

    @patch("sentry.integrations.slack.webhooks.action._logger")
    def test_assign_issue_error(self, mock_logger):
        mock_slack_response = SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={"ok": False},
            headers={},
            status_code=200,
        )

        self.mock_post.side_effect = SlackApiError("error", mock_slack_response)

        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        original_message = self.get_original_message(self.group.id)

        # Assign to user
        resp = self.assign_issue(original_message, user2)
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
        expect_status = f"*Issue assigned to {user2.get_display_name()} by <@{self.external_id}>*"
        assert self.notification_text in resp.data["blocks"][1]["text"]["text"]
        assert resp.data["blocks"][2]["text"]["text"].endswith(expect_status), resp.data["text"]
        assert ":white_circle:" in resp.data["blocks"][0]["text"]["text"]

        # Assert group assignment activity recorded
        group_activity = list(Activity.objects.filter(group=self.group))
        assert group_activity[0].data == {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.SLACK.value,
        }

        mock_logger.exception.assert_called_with(
            "slack.webhook.update_status.response-error",
        )

    def test_assign_issue_through_unfurl(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])

        # Assign to user
        self.assign_issue(original_message, user2, payload_data)
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = f"*Issue assigned to {user2.get_display_name()} by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

        # Assign to team
        self.assign_issue(original_message, self.team, payload_data)
        assert GroupAssignee.objects.filter(group=self.group, team=self.team).exists()
        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = f"*Issue assigned to #{self.team.slug} by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

        # Assert group assignment activity recorded
        group_activity = list(Activity.objects.filter(group=self.group))
        assert group_activity[0].data == {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.SLACK.value,
        }
        assert group_activity[-1].data == {
            "assignee": str(self.team.id),
            "assigneeEmail": None,
            "assigneeType": "team",
            "integration": ActivityIntegration.SLACK.value,
        }

    def test_assign_issue_where_team_not_in_project(self):
        user2 = self.create_user(is_superuser=False)
        team2 = self.create_team(
            organization=self.organization, members=[self.user], name="Ecosystem"
        )
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_project(name="hellboy", organization=self.organization, teams=[team2])
        # Assign to team
        original_message = self.get_original_message(self.group.id)
        resp = self.assign_issue(original_message, team2)
        assert resp.data["text"].endswith("Cannot assign to a team without access to the project")
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_assign_issue_where_team_not_in_project_through_unfurl(self):
        user2 = self.create_user(is_superuser=False)
        team2 = self.create_team(
            organization=self.organization, members=[self.user], name="Ecosystem"
        )
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_project(name="hellboy", organization=self.organization, teams=[team2])
        # Assign to team
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        resp = self.assign_issue(original_message, team2, payload_data)
        assert resp.data["text"].endswith("Cannot assign to a team without access to the project")
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_assign_issue_user_has_identity(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        original_message = self.get_original_message(self.group.id)
        self.assign_issue(original_message, user2)
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]

        expect_status = (
            f"*Issue assigned to <@{user2_identity.external_id}> by <@{self.external_id}>*"
        )
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

    def test_assign_issue_user_has_identity_through_unfurl(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])

        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.assign_issue(original_message, user2, payload_data)
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = (
            f"*Issue assigned to <@{user2_identity.external_id}> by <@{self.external_id}>*"
        )
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

    def test_assign_user_with_multiple_identities(self):
        org2 = self.create_organization(owner=None)

        integration2 = self.create_integration(
            organization=org2,
            provider="slack",
            external_id="TXXXXXXX2",
        )
        idp2 = self.create_identity_provider(integration=integration2)
        self.create_identity(
            external_id="slack_id2",
            identity_provider=idp2,
            user=self.user,
        )
        original_message = self.get_original_message(self.group.id)
        self.assign_issue(original_message, self.user)
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = "*Issue assigned to <@{assignee}> by <@{assignee}>*".format(
            assignee=self.external_id
        )
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

    def test_assign_user_with_multiple_identities_through_unfurl(self):
        org2 = self.create_organization(owner=None)

        integration2 = self.create_integration(
            organization=org2,
            provider="slack",
            external_id="TXXXXXXX2",
        )
        idp2 = self.create_identity_provider(integration=integration2)
        self.create_identity(
            external_id="slack_id2",
            identity_provider=idp2,
            user=self.user,
        )
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.assign_issue(original_message, self.user, payload_data)
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()

        blocks = self.mock_post.call_args.kwargs["blocks"]
        text = self.mock_post.call_args.kwargs["text"]
        expect_status = "*Issue assigned to <@{assignee}> by <@{assignee}>*".format(
            assignee=self.external_id
        )
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status), text

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_issue(self, mock_tags, mock_record):
        original_message = self.get_original_message(self.group.id)
        self.resolve_issue(original_message, "resolved", mock_record)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        assert not GroupResolution.objects.filter(group=self.group)

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"] == expect_status
        assert ":white_circle:" in blocks[0]["text"]["text"]

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_perf_issue(self, mock_tags, mock_record):
        group_fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-group1"

        event_data_2 = load_data("transaction-n-plus-one", fingerprint=[group_fingerprint])
        event_data_2["timestamp"] = before_now(seconds=20).isoformat()
        event_data_2["start_timestamp"] = before_now(seconds=21).isoformat()
        event_data_2["event_id"] = "f" * 32

        perf_issue = self.create_performance_issue(
            event_data=event_data_2, fingerprint=group_fingerprint
        )
        self.group = perf_issue.group
        assert self.group

        original_message = self.get_original_message(self.group.id)
        self.resolve_issue(original_message, "resolved", mock_record)

        self.group.refresh_from_db()
        assert self.group.get_status() == GroupStatus.RESOLVED
        assert not GroupResolution.objects.filter(group=self.group)

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert (
            "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
            in blocks[2]["text"]["text"]
        )
        assert blocks[3]["text"]["text"] == expect_status
        assert ":white_circle: :chart_with_upwards_trend:" in blocks[0]["text"]["text"]

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_issue_through_unfurl(self, mock_tags):
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.resolve_issue(original_message, "resolved", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        assert not GroupResolution.objects.filter(group=self.group)

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"] == expect_status

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_issue_in_current_release(self, mock_tags, mock_record):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)

        original_message = self.get_original_message(self.group.id)
        self.resolve_issue(original_message, "resolved:inCurrentRelease", mock_record)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=self.group)
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.release == release

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_issue_in_current_release_through_unfurl(self, mock_tags):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)

        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.resolve_issue(original_message, "resolved:inCurrentRelease", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=self.group)
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.release == release

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_in_next_release(self, mock_tags, mock_record):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)
        original_message = self.get_original_message(self.group.id)
        self.resolve_issue(original_message, "resolved:inNextRelease", mock_record)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=self.group)
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.release == release

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch("sentry.integrations.slack.message_builder.issues.get_tags", return_value=[])
    def test_resolve_in_next_release_through_unfurl(self, mock_tags):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        self.resolve_issue(original_message, "resolved:inNextRelease", payload_data)

        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        resolution = GroupResolution.objects.get(group=self.group)
        assert resolution.type == GroupResolution.Type.in_next_release
        assert resolution.release == release

        blocks = self.mock_post.call_args.kwargs["blocks"]
        assert mock_tags.call_args.kwargs["tags"] == self.tags

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch(
        "slack_sdk.web.WebClient.views_update",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/views.update",
            req_args={},
            data={"ok": True},
            headers={},
            status_code=200,
        ),
    )
    def test_response_differs_on_bot_message(self, _mock_view_updates_open):
        status_action = self.get_archive_status_action()
        original_message = self.get_original_message(self.group.id)

        resp = self.post_webhook_block_kit(
            action_data=[status_action],
            original_message=original_message,
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = _mock_view_updates_open.call_args.kwargs["external_id"]
        view: View = _mock_view_updates_open.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        resp = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option="ignored:archived_forever",
        )
        assert resp.status_code == 200, resp.content
        self.group = Group.objects.get(id=self.group.id)

        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        blocks = self.mock_post.call_args.kwargs["blocks"]

        expect_status = f"*Issue archived by <@{self.external_id}>*"
        assert self.notification_text in blocks[1]["text"]["text"]
        assert blocks[2]["text"]["text"].endswith(expect_status)

    @patch(
        "slack_sdk.web.WebClient.views_update",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/views.update",
            req_args={},
            data={"ok": True},
            headers={},
            status_code=200,
        ),
    )
    def test_permission_denied(self, _mock_view_update):
        user2 = self.create_user(is_superuser=False)
        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        status_action = self.get_archive_status_action()
        original_message = self.get_original_message(self.group.id)
        assert self.group.get_status() == GroupStatus.UNRESOLVED

        # Expect request to open dialog on slack; will only get permission denied when trying to complete an action
        resp = self.post_webhook_block_kit(
            action_data=[status_action],
            original_message=original_message,
            slack_user={"id": user2_identity.external_id},
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = _mock_view_update.call_args.kwargs["external_id"]
        view: View = _mock_view_update.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        resp = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option="ignored:archived_forever",
            slack_user={"id": user2_identity.external_id},
        )

        assert resp.status_code == 200, resp.content
        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.UNRESOLVED

        associate_url = build_unlinking_url(
            self.integration.id, "slack_id2", "C065W1189", self.response_url
        )

        assert resp.data["response_type"] == "ephemeral"
        assert not resp.data["replace_original"]
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=user2.email, org_name=self.organization.name
        )

    @patch(
        "slack_sdk.web.WebClient.views_update",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/views.update",
            req_args={},
            data={"ok": True},
            headers={},
            status_code=200,
        ),
    )
    def test_permission_denied_through_unfurl(self, _mock_view_updates_open):
        user2 = self.create_user(is_superuser=False)
        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        status_action = self.get_archive_status_action()
        original_message = self.get_original_message(self.group.id)

        data = self.get_unfurl_data(original_message["blocks"])
        resp = self.post_webhook_block_kit(
            action_data=[status_action],
            data=data,
            slack_user={"id": user2_identity.external_id},
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = _mock_view_updates_open.call_args.kwargs["external_id"]
        view: View = _mock_view_updates_open.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        resp = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option="ignored:archived_until_escalating",
            slack_user={"id": user2_identity.external_id},
        )
        assert resp.status_code == 200, resp.content
        self.group = Group.objects.get(id=self.group.id)

        associate_url = build_unlinking_url(
            self.integration.id, "slack_id2", "C065W1189", self.response_url
        )

        assert resp.data["response_type"] == "ephemeral"
        assert not resp.data["replace_original"]
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=user2.email, org_name=self.organization.name
        )

    @freeze_time("2021-01-14T12:27:28.303Z")
    @patch(
        "slack_sdk.web.WebClient.views_update",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/views.update",
            req_args={},
            data={"ok": False},
            headers={},
            status_code=200,
        ),
    )
    def test_handle_submission_fail(self, mock_open_view):
        status_action = self.get_resolve_status_action()
        original_message = self.get_original_message(self.group.id)
        # Expect request to open dialog on slack
        resp = self.post_webhook_block_kit(
            action_data=[status_action], original_message=original_message
        )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = mock_open_view.call_args.kwargs["external_id"]
        view: View = mock_open_view.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        # Remove the user from the organization.
        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        member.remove_user()
        member.save()
        response = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option="resolved",
        )

        assert response.status_code == 200, response.content
        assert response.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=build_unlinking_url(
                integration_id=self.integration.id,
                slack_id=self.external_id,
                channel_id="C065W1189",
                response_url=self.response_url,
            ),
            user_email=self.user.email,
            org_name=self.organization.name,
        )

    @freeze_time("2021-01-14T12:27:28.303Z")
    @patch(
        "slack_sdk.web.WebClient.views_update",
        return_value=SlackResponse(
            client=None,
            http_verb="POST",
            api_url="https://slack.com/api/views.update",
            req_args={},
            data={"ok": False},
            headers={},
            status_code=200,
        ),
    )
    def test_handle_submission_fail_through_unfurl(self, mock_open_view):
        status_action = self.get_resolve_status_action()
        original_message = self.get_original_message(self.group.id)
        payload_data = self.get_unfurl_data(original_message["blocks"])
        # Expect request to open dialog on slack
        resp = self.post_webhook_block_kit(action_data=[status_action], data=payload_data)
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        trigger_id = mock_open_view.call_args.kwargs["external_id"]
        view: View = mock_open_view.call_args.kwargs["view"]

        assert trigger_id == status_action["action_ts"]
        assert view.private_metadata is not None
        private_metadata = orjson.loads(view.private_metadata)
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        # Remove the user from the organization.
        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        member.remove_user()
        member.save()
        response = self.post_webhook_block_kit(
            type="view_submission",
            private_metadata=orjson.dumps(private_metadata).decode(),
            selected_option="resolved",
        )

        assert response.status_code == 200, response.content
        assert response.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=build_unlinking_url(
                integration_id=self.integration.id,
                slack_id=self.external_id,
                channel_id="C065W1189",
                response_url=self.response_url,
            ),
            user_email=self.user.email,
            org_name=self.organization.name,
        )

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def test_no_integration(self, check_signing_secret_mock):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()
        resp = self.post_webhook()
        assert resp.status_code == 403

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def test_slack_bad_payload(self, check_signing_secret_mock):
        resp = self.client.post("/extensions/slack/action/", data={"nopayload": 0})
        assert resp.status_code == 400

    @patch(
        "sentry.integrations.slack.requests.SlackRequest._check_signing_secret", return_value=True
    )
    def test_sentry_docs_link_clicked(self, check_signing_secret_mock):
        payload = {
            "team": {"id": "TXXXXXXX1", "domain": "example.com"},
            "user": {"id": self.external_id, "domain": "example"},
            "type": "block_actions",
            "actions": [
                {
                    "name": "",
                    "value": "sentry_docs_link_clicked",
                }
            ],
        }

        payload = {"payload": orjson.dumps(payload).decode()}

        resp = self.client.post("/extensions/slack/action/", data=payload)
        assert resp.status_code == 200

    def test_approve_join_request(self):
        other_user = self.create_user()
        member = self.create_member(
            organization=self.organization,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
        self.assert_org_member_mapping(org_member=member)

        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content

        self.assert_org_member_mapping(org_member=member)
        assert member.invite_status == InviteStatus.APPROVED.value

        manage_url = absolute_uri(
            reverse("sentry-organization-members", args=[self.organization.slug])
        )
        assert (
            resp.data["text"]
            == f"Join request for hello@sentry.io has been approved. <{manage_url}|See Members and Requests>."
        )

    def test_rejected_invite_request(self):
        other_user = self.create_user()
        member = OrganizationMember.objects.create(
            organization=self.organization,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )

        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "reject_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert not OrganizationMember.objects.filter(id=member.id).exists()

        manage_url = absolute_uri(
            reverse("sentry-organization-members", args=[self.organization.slug])
        )
        assert (
            resp.data["text"]
            == f"Invite request for hello@sentry.io has been rejected. <{manage_url}|See Members and Requests>."
        )

    def test_invalid_rejected_invite_request(self):
        user = self.create_user(email="hello@sentry.io")
        member = self.create_member(
            organization=self.organization,
            role="member",
            user=user,
            invite_status=InviteStatus.APPROVED.value,
        )

        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "reject_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert OrganizationMember.objects.filter(id=member.id).exists()
        member.refresh_from_db()
        self.assert_org_member_mapping(org_member=member)

        assert resp.data["text"] == "Member invitation for hello@sentry.io no longer exists."

    def test_invitation_removed(self):
        other_user = self.create_user()
        member = OrganizationMember.objects.create(
            organization=self.organization,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()
        member.delete()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "Member invitation for hello@sentry.io no longer exists."

    def test_invitation_already_accepted(self):
        other_user = self.create_user()
        member = OrganizationMember.objects.create(
            organization=self.organization,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.APPROVED.value,
        )
        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "Member invitation for hello@sentry.io no longer exists."

    def test_invitation_validation_error(self):
        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(user_id=self.user.id).update(role="manager")
        other_user = self.create_user()
        member = OrganizationMember.objects.create(
            organization=self.organization,
            email="hello@sentry.io",
            role="owner",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert (
            resp.data["text"]
            == "You do not have permission to approve a member invitation with the role owner."
        )

    def test_identity_not_linked(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            Identity.objects.filter(user=self.user).delete()
        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id="")

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "Identity not linked for user."

    def test_wrong_organization(self):
        other_user = self.create_user()
        another_org = self.create_organization()
        member = OrganizationMember.objects.create(
            organization=another_org,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "You do not have access to the organization for the invitation."

    def test_no_member_admin(self):
        with unguarded_write(using=router.db_for_write(OrganizationMember)):
            OrganizationMember.objects.filter(user_id=self.user.id).update(role="admin")

        other_user = self.create_user()
        member = OrganizationMember.objects.create(
            organization=self.organization,
            email="hello@sentry.io",
            role="member",
            inviter_id=other_user.id,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        callback_id = orjson.dumps(
            {"member_id": member.id, "member_email": "hello@sentry.io"}
        ).decode()

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "You do not have permission to approve member invitations."
