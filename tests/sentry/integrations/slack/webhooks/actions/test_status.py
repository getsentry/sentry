from unittest.mock import patch
from urllib.parse import parse_qs

import responses
from django.db import router
from django.urls import reverse

from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.integrations.slack.webhooks.action import LINK_IDENTITY_MESSAGE, UNLINK_IDENTITY_MESSAGE
from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.identity import Identity
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.release import Release
from sentry.silo import SiloMode, unguarded_write
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from sentry.utils.http import absolute_uri

from . import BaseEventTest

pytestmark = [requires_snuba]


@region_silo_test
class StatusActionTest(BaseEventTest, HybridCloudTestMixin):
    def setUp(self):
        super().setUp()
        self.event_data = {
            "event_id": "a" * 32,
            "message": "IntegrationError",
            "fingerprint": ["group-1"],
            "exception": {
                "values": [
                    {
                        "type": "IntegrationError",
                        "value": "Identity not found.",
                    }
                ]
            },
        }
        self.original_message = {
            "type": "message",
            "attachments": [
                {
                    "id": 1,
                    "ts": 1681409875,
                    "color": "E03E2F",
                    "fallback": "[node] IntegrationError: Identity not found.",
                    "text": "Identity not found.",
                    "title": "IntegrationError",
                    "footer": "NODE-F via <http://localhost:8000/organizations/sentry/alerts/rules/node/3/details/|New Issue in #critical channel>",
                    "mrkdwn_in": ["text"],
                }
            ],
        }

    def get_original_message_block_kit(self, group_id):
        return {
            "blocks": [
                {
                    "type": "section",
                    "block_id": json.dumps({"issue": group_id}),
                    "text": {"type": "mrkdwn", "text": "boop", "verbatim": False},
                },
            ],
        }

    def get_ignore_status_action(self, text, selection):
        return {
            "action_id": selection,
            "block_id": "bXwil",
            "text": {
                "type": "plain_text",
                "text": text,
                "emoji": True,
            },
            "value": selection,
            "type": "button",
            "action_ts": "1702424387.108033",
        }

    def get_assign_status_action(self, type, text, id):
        return {
            "type": "static_select",
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

    def test_ignore_issue(self):
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        status_action = {"name": "status", "value": "ignored:forever", "type": "button"}
        assert event.group is not None
        resp = self.post_webhook(
            action_data=[status_action],
            original_message=self.original_message,
            type="interactive_message",
            callback_id=json.dumps({"issue": event.group.id}),
        )
        self.group = Group.objects.get(id=event.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        expect_status = f"Identity not found.\n*Issue ignored by <@{self.external_id}>*"
        assert resp.data["attachments"][0]["text"] == expect_status

        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(
                action_data=[status_action],
                original_message=self.original_message,
                type="interactive_message",
                callback_id=json.dumps({"issue": event.group.id}),
            )
            self.group = Group.objects.get(id=event.group.id)

            assert resp.status_code == 200, resp.content
            assert self.group.get_status() == GroupStatus.IGNORED
            assert self.group.substatus == GroupSubStatus.FOREVER
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_ignore_issue_block_kit(self):
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        assert event.group is not None
        group = event.group
        original_message = self.get_original_message_block_kit(group.id)
        status_action = self.get_ignore_status_action("Ignore", "ignored:forever")

        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action],
                original_message=original_message,
            )
            self.group = Group.objects.get(id=event.group.id)

            assert resp.status_code == 200, resp.content
            assert self.group.get_status() == GroupStatus.IGNORED
            assert self.group.substatus == GroupSubStatus.FOREVER
            expect_status = f"Identity not found.\n*Issue ignored by <@{self.external_id}>*"
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_archive_issue(self):
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        status_action = {"name": "status", "value": "ignored:until_escalating", "type": "button"}
        assert event.group is not None
        resp = self.post_webhook(
            action_data=[status_action],
            original_message=self.original_message,
            type="interactive_message",
            callback_id=json.dumps({"issue": event.group.id}),
        )
        self.group = Group.objects.get(id=event.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_ESCALATING

        expect_status = f"Identity not found.\n*Issue ignored by <@{self.external_id}>*"
        assert resp.data["attachments"][0]["text"] == expect_status

        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(
                action_data=[status_action],
                original_message=self.original_message,
                type="interactive_message",
                callback_id=json.dumps({"issue": event.group.id}),
            )
            self.group = Group.objects.get(id=event.group.id)

            assert resp.status_code == 200, resp.content
            assert self.group.get_status() == GroupStatus.IGNORED
            assert self.group.substatus == GroupSubStatus.UNTIL_ESCALATING
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_archive_issue_block_kit(self):
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        assert event.group is not None
        status_action = self.get_ignore_status_action("Archive", "ignored:until_escalating")
        original_message = self.get_original_message_block_kit(event.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action],
                original_message=original_message,
            )
        self.group = Group.objects.get(id=event.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.UNTIL_ESCALATING

        expect_status = f"Identity not found.\n*Issue ignored by <@{self.external_id}>*"
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_ignore_issue_with_additional_user_auth(self):
        """
        Ensure that we can act as a user even when the organization has SSO enabled
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth_idp = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
            AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)

        status_action = {"name": "status", "value": "ignored:forever", "type": "button"}

        resp = self.post_webhook(action_data=[status_action])
        self.group = Group.objects.get(id=self.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        expect_status = f"*Issue ignored by <@{self.external_id}>*"
        assert resp.data["text"].endswith(expect_status), resp.data["text"]

        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action])
            self.group = Group.objects.get(id=self.group.id)

            assert resp.status_code == 200, resp.content
            assert self.group.get_status() == GroupStatus.IGNORED
            assert self.group.substatus == GroupSubStatus.FOREVER
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_ignore_issue_with_additional_user_auth_block_kit(self):
        """
        Ensure that we can act as a user even when the organization has SSO enabled
        """
        with assume_test_silo_mode(SiloMode.CONTROL):
            auth_idp = AuthProvider.objects.create(
                organization_id=self.organization.id, provider="dummy"
            )
            AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)
        event = self.store_event(
            data=self.event_data,
            project_id=self.project.id,
        )
        assert event.group is not None
        original_message = self.get_original_message_block_kit(event.group.id)
        status_action = self.get_ignore_status_action("Ignore", "ignored:forever")
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action],
                original_message=original_message,
            )
        self.group = Group.objects.get(id=event.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER

        expect_status = f"*Issue ignored by <@{self.external_id}>*"
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_assign_issue(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])

        # Assign to user
        status_action = {
            "name": "assign",
            "selected_options": [{"value": f"user:{user2.id}"}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        expect_status = f"*Issue assigned to {user2.get_display_name()} by <@{self.external_id}>*"

        # Assign to team
        status_action = {
            "name": "assign",
            "selected_options": [{"value": f"team:{self.team.id}"}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, team=self.team).exists()
        activity = Activity.objects.filter(group=self.group).first()
        assert activity.data == {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.SLACK.value,
        }

        expect_status = f"*Issue assigned to #{self.team.slug} by <@{self.external_id}>*"

        assert resp.data["text"].endswith(expect_status), resp.data["text"]

        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action])

            assert resp.status_code == 200, resp.content
            assert GroupAssignee.objects.filter(group=self.group, team=self.team).exists()
            activity = Activity.objects.filter(group=self.group).first()
            assert activity.data == {
                "assignee": str(user2.id),
                "assigneeEmail": user2.email,
                "assigneeType": "user",
                "integration": ActivityIntegration.SLACK.value,
            }

            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    def test_assign_issue_block_kit(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])
        status_action = self.get_assign_status_action("user", user2.email, user2.id)
        original_message = self.get_original_message_block_kit(self.group.id)
        # Assign to user
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        expect_status = f"*Issue assigned to {user2.get_display_name()} by <@{self.external_id}>*"
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

        # Assign to team
        status_action = self.get_assign_status_action("team", self.team.slug, self.team.id)
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, team=self.team).exists()
        activity = Activity.objects.filter(group=self.group).first()
        assert activity.data == {
            "assignee": str(user2.id),
            "assigneeEmail": user2.email,
            "assigneeType": "user",
            "integration": ActivityIntegration.SLACK.value,
        }

        expect_status = f"*Issue assigned to #{self.team.slug} by <@{self.external_id}>*"
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    def test_assign_issue_where_team_not_in_project(self):
        user2 = self.create_user(is_superuser=False)

        team2 = self.create_team(
            organization=self.organization, members=[self.user], name="Ecosystem"
        )
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_project(name="hellboy", organization=self.organization, teams=[team2])
        # Assign to team
        status_action = {
            "name": "assign",
            "selected_options": [{"value": f"team:{team2.id}"}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "Cannot assign to a team without access to the project"
        assert not GroupAssignee.objects.filter(group=self.group).exists()
        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action])

            assert resp.status_code == 200, resp.content
            assert resp.data["text"].endswith(
                "Cannot assign to a team without access to the project"
            )
            assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_assign_issue_where_team_not_in_project_block_kit(self):
        user2 = self.create_user(is_superuser=False)
        team2 = self.create_team(
            organization=self.organization, members=[self.user], name="Ecosystem"
        )
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        self.create_project(name="hellboy", organization=self.organization, teams=[team2])
        # Assign to team
        status_action = self.get_assign_status_action("team", team2.slug, team2.id)
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook(action_data=[status_action], original_message=original_message)

        assert resp.status_code == 200, resp.content
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

        status_action = {
            "name": "assign",
            "selected_options": [{"value": f"user:{user2.id}"}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        expect_status = (
            f"*Issue assigned to <@{user2_identity.external_id}> by <@{self.external_id}>*"
        )

        assert resp.data["text"].endswith(expect_status), resp.data["text"]
        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action])
            assert resp.status_code == 200, resp.content
            assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    def test_assign_issue_user_has_identity_block_kit(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.organization, teams=[self.team])

        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        status_action = self.get_assign_status_action("user", user2.email, user2.id)
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=user2.id).exists()

        expect_status = (
            f"*Issue assigned to <@{user2_identity.external_id}> by <@{self.external_id}>*"
        )
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    def test_response_differs_on_bot_message(self):
        status_action = {"name": "status", "value": "ignored:forever", "type": "button"}

        original_message = {"type": "message"}

        resp = self.post_webhook(action_data=[status_action], original_message=original_message)
        self.group = Group.objects.get(id=self.group.id)

        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER
        assert resp.status_code == 200, resp.content
        assert "attachments" in resp.data
        assert resp.data["attachments"][0]["title"] == self.group.title

        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action], original_message=original_message)
            self.group = Group.objects.get(id=self.group.id)
            assert self.group.get_status() == GroupStatus.IGNORED
            assert self.group.substatus == GroupSubStatus.FOREVER
            assert resp.status_code == 200, resp.content
            assert "blocks" in resp.data
            assert self.group.title in resp.data["blocks"][0]["text"]["text"]

    def test_response_differs_on_bot_message_block_kit(self):
        status_action = self.get_ignore_status_action("Ignore", "ignored:forever")
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )
        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.IGNORED
        assert self.group.substatus == GroupSubStatus.FOREVER
        assert resp.status_code == 200, resp.content
        assert "blocks" in resp.data
        assert self.group.title in resp.data["blocks"][0]["text"]["text"]

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

        status_action = {
            "name": "assign",
            "selected_options": [{"value": f"user:{self.user.id}"}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()

        expect_status = "*Issue assigned to <@{assignee}> by <@{assignee}>*".format(
            assignee=self.external_id
        )

        assert resp.data["text"].endswith(expect_status), resp.data["text"]
        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(action_data=[status_action])
            assert resp.status_code == 200, resp.content
            assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
            assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    def test_assign_user_with_multiple_identities_block_kit(self):
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
        status_action = self.get_assign_status_action("user", self.user.email, self.user.id)
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()

        expect_status = "*Issue assigned to <@{assignee}> by <@{assignee}>*".format(
            assignee=self.external_id
        )
        assert resp.data["blocks"][0]["text"]["text"].endswith(expect_status), resp.data["text"]

    @responses.activate
    def test_resolve_issue(self):
        status_action = {"name": "resolve_dialog", "value": "resolve_dialog"}

        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/dialog.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(action_data=[status_action])
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = parse_qs(responses.calls[0].request.body)
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(
            type="dialog_submission",
            callback_id=dialog["callback_id"],
            data={"submission": {"resolve_type": "resolved"}},
        )
        self.group = Group.objects.get(id=self.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.RESOLVED

        update_data = json.loads(responses.calls[1].request.body)

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert update_data["text"].endswith(expect_status)

    @responses.activate
    def test_resolve_issue_backwards_compat_block_kit(self):
        """Test backwards compatibility of resolving an issue from a legacy Slack notification
        with the block kit feature flag enabled"""
        status_action = {"name": "resolve_dialog", "value": "dialog"}

        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/dialog.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(action_data=[status_action])
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = parse_qs(responses.calls[0].request.body)
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook(
                type="dialog_submission",
                callback_id=dialog["callback_id"],
                data={"submission": {"resolve_type": "resolved"}},
            )
        self.group = Group.objects.get(id=self.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.RESOLVED

        update_data = json.loads(responses.calls[1].request.body)

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert update_data["blocks"][0]["text"]["text"].endswith(expect_status)

    @responses.activate
    def test_resolve_issue_block_kit(self):
        status_action = self.get_resolve_status_action()
        original_message = self.get_original_message_block_kit(self.group.id)
        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/views.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = json.loads(responses.calls[0].request.body)
        assert data["trigger_id"] == self.trigger_id
        assert "view" in data

        view = json.loads(data["view"])
        private_metadata = json.loads(view["private_metadata"])
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                type="view_submission",
                private_metadata=json.dumps(private_metadata),
                selected_option="resolved",
            )

        assert resp.status_code == 200, resp.content
        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED

        update_data = json.loads(responses.calls[1].request.body)

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert update_data["blocks"][0]["text"]["text"].endswith(expect_status)

    @responses.activate
    def test_resolve_issue_in_next_release(self):
        status_action = {"name": "resolve_dialog", "value": "resolve_dialog"}

        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)

        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/dialog.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(action_data=[status_action])
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = parse_qs(responses.calls[0].request.body)
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(
            type="dialog_submission",
            callback_id=dialog["callback_id"],
            data={"submission": {"resolve_type": "resolved:inNextRelease"}},
        )
        self.group = Group.objects.get(id=self.group.id)

        assert resp.status_code == 200, resp.content
        assert self.group.get_status() == GroupStatus.RESOLVED

        update_data = json.loads(responses.calls[1].request.body)

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert update_data["text"].endswith(expect_status)

    @responses.activate
    def test_resolve_issue_in_next_release_backwards_compat_block_kit(self):
        """Test backwards compatibility of resolving a legacy formatted Slack notification
        with the block kit feature flag enabled"""
        status_action = {"name": "resolve_dialog", "value": "resolve_dialog"}

        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)

        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/dialog.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(action_data=[status_action])
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = parse_qs(responses.calls[0].request.body)
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook(
                type="dialog_submission",
                callback_id=dialog["callback_id"],
                data={"submission": {"resolve_type": "resolved:inNextRelease"}},
            )
            self.group = Group.objects.get(id=self.group.id)

            assert resp.status_code == 200, resp.content
            assert self.group.get_status() == GroupStatus.RESOLVED

            update_data = json.loads(responses.calls[1].request.body)
            expect_status = f"*Issue resolved by <@{self.external_id}>*"
            assert update_data["blocks"][0]["text"]["text"].endswith(expect_status)

    @responses.activate
    def test_resolve_in_next_release_block_kit(self):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)
        status_action = self.get_resolve_status_action()
        original_message = self.get_original_message_block_kit(self.group.id)
        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/views.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = json.loads(responses.calls[0].request.body)
        assert data["trigger_id"] == self.trigger_id
        assert "view" in data

        view = json.loads(data["view"])
        private_metadata = json.loads(view["private_metadata"])
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                type="view_submission",
                private_metadata=json.dumps(private_metadata),
                selected_option="resolved:inNextRelease",
            )

        assert resp.status_code == 200, resp.content
        self.group = Group.objects.get(id=self.group.id)
        assert self.group.get_status() == GroupStatus.RESOLVED
        update_data = json.loads(responses.calls[1].request.body)

        expect_status = f"*Issue resolved by <@{self.external_id}>*"
        assert update_data["blocks"][0]["text"]["text"].endswith(expect_status)

    def test_permission_denied(self):
        user2 = self.create_user(is_superuser=False)

        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )

        status_action = {"name": "status", "value": "ignored:forever", "type": "button"}

        resp = self.post_webhook(
            action_data=[status_action], slack_user={"id": user2_identity.external_id}
        )
        self.group = Group.objects.get(id=self.group.id)

        associate_url = build_unlinking_url(
            self.integration.id, "slack_id2", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["response_type"] == "ephemeral"
        assert not resp.data["replace_original"]
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=user2.email, org_name=self.organization.name
        )
        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            resp = self.post_webhook(
                action_data=[status_action], slack_user={"id": user2_identity.external_id}
            )

            assert resp.status_code == 200, resp.content
            assert resp.data["response_type"] == "ephemeral"
            assert not resp.data["replace_original"]
            assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
                associate_url=associate_url, user_email=user2.email, org_name=self.organization.name
            )

    def test_permission_denied_block_kit(self):
        user2 = self.create_user(is_superuser=False)
        user2_identity = self.create_identity(
            external_id="slack_id2",
            identity_provider=self.idp,
            user=user2,
        )
        status_action = self.get_ignore_status_action("Ignore", "ignored:forever")
        original_message = self.get_original_message_block_kit(self.group.id)
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action],
                original_message=original_message,
                slack_user={"id": user2_identity.external_id},
            )
        self.group = Group.objects.get(id=self.group.id)

        associate_url = build_unlinking_url(
            self.integration.id, "slack_id2", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["response_type"] == "ephemeral"
        assert not resp.data["replace_original"]
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=user2.email, org_name=self.organization.name
        )

    @freeze_time("2021-01-14T12:27:28.303Z")
    @responses.activate
    def test_handle_submission_fail(self):
        status_action = {"name": "resolve_dialog", "value": "resolve_dialog"}

        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/dialog.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        resp = self.post_webhook(action_data=[status_action])
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = parse_qs(responses.calls[0].request.body)
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Remove the user from the organization.
        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        member.remove_user()
        member.save()

        response = self.post_webhook(
            type="dialog_submission",
            callback_id=dialog["callback_id"],
            data={"submission": {"resolve_type": "resolved"}},
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
        with self.feature("organizations:slack-block-kit"):
            # test backwards compatibility
            response = self.post_webhook(
                type="dialog_submission",
                callback_id=dialog["callback_id"],
                data={"submission": {"resolve_type": "resolved"}},
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
    @responses.activate
    def test_handle_submission_fail_block_kit(self):
        status_action = self.get_resolve_status_action()
        original_message = self.get_original_message_block_kit(self.group.id)
        # Expect request to open dialog on slack
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/views.open",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        with self.feature("organizations:slack-block-kit"):
            resp = self.post_webhook_block_kit(
                action_data=[status_action], original_message=original_message
            )
        assert resp.status_code == 200, resp.content

        # Opening dialog should *not* cause the current message to be updated
        assert resp.content == b""

        data = json.loads(responses.calls[0].request.body)
        assert data["trigger_id"] == self.trigger_id
        assert "view" in data

        view = json.loads(data["view"])
        private_metadata = json.loads(view["private_metadata"])
        assert int(private_metadata["issue"]) == self.group.id
        assert private_metadata["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Remove the user from the organization.
        member = OrganizationMember.objects.get(
            user_id=self.user.id, organization=self.organization
        )
        member.remove_user()
        member.save()
        with self.feature("organizations:slack-block-kit"):
            response = self.post_webhook_block_kit(
                type="view_submission",
                private_metadata=json.dumps(private_metadata),
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

        payload = {"payload": json.dumps(payload)}

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

        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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

        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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

        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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
        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})
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
        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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
        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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
        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

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
        callback_id = json.dumps({"member_id": member.id, "member_email": "hello@sentry.io"})

        resp = self.post_webhook(action_data=[{"value": "approve_member"}], callback_id=callback_id)

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == "You do not have permission to approve member invitations."
