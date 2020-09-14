from __future__ import absolute_import

import responses

from six.moves.urllib.parse import parse_qs
from sentry.utils.compat.mock import patch

from sentry.api import client
from sentry import options
from sentry.models import (
    Integration,
    OrganizationIntegration,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Group,
    GroupStatus,
    GroupAssignee,
    AuthProvider,
    AuthIdentity,
)
from sentry.testutils import APITestCase
from sentry.utils import json
from sentry.integrations.slack.action_endpoint import LINK_IDENTITY_MESSAGE, UNLINK_IDENTITY_MESSAGE
from sentry.integrations.slack.link_identity import build_linking_url
from sentry.integrations.slack.unlink_identity import build_unlinking_url


class BaseEventTest(APITestCase):
    def setUp(self):
        super(BaseEventTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.integration = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="slack_id",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        self.project1 = self.create_project(organization=self.org)
        self.group1 = self.create_group(project=self.project1)

        self.trigger_id = "13345224609.738474920.8088930838d88f008e0"
        self.response_url = (
            "https://hooks.slack.com/actions/T47563693/6204672533/x7ZLaiVMoECAW50Gw1ZYAXEM"
        )

    def post_webhook(
        self,
        action_data=None,
        type="event_callback",
        data=None,
        token=None,
        team_id="TXXXXXXX1",
        callback_id=None,
        slack_user=None,
        original_message=None,
    ):
        if token is None:
            token = options.get("slack.verification-token")

        if slack_user is None:
            slack_user = {"id": self.identity.external_id, "domain": "example"}

        if callback_id is None:
            callback_id = json.dumps({"issue": self.group1.id})

        if original_message is None:
            original_message = {}

        payload = {
            "token": token,
            "team": {"id": team_id, "domain": "example.com"},
            "channel": {"id": "C065W1189", "domain": "forgotten-works"},
            "user": slack_user,
            "callback_id": callback_id,
            "action_ts": "1458170917.164398",
            "message_ts": "1458170866.000004",
            "original_message": original_message,
            "trigger_id": self.trigger_id,
            "response_url": self.response_url,
            "attachment_id": "1",
            "actions": action_data or [],
            "type": type,
        }
        if data:
            payload.update(data)

        payload = {"payload": json.dumps(payload)}

        return self.client.post("/extensions/slack/action/", data=payload)


class StatusActionTest(BaseEventTest):
    @patch("sentry.integrations.slack.link_identity.sign")
    def test_ask_linking(self, sign):
        sign.return_value = "signed_parameters"

        resp = self.post_webhook(slack_user={"id": "invalid-id", "domain": "example"})

        associate_url = build_linking_url(
            self.integration, self.org, "invalid-id", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["response_type"] == "ephemeral"
        assert resp.data["text"] == LINK_IDENTITY_MESSAGE.format(associate_url=associate_url)

    def test_ignore_issue(self):
        status_action = {"name": "status", "value": "ignored", "type": "button"}

        resp = self.post_webhook(action_data=[status_action])
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.IGNORED

        expect_status = u"*Issue ignored by <@{}>*".format(self.identity.external_id)
        assert resp.data["text"].endswith(expect_status), resp.data["text"]

    def test_ignore_issue_with_additional_user_auth(self):
        """
        Ensure that we can act as a user even when the organization has SSO enabled
        """
        auth_idp = AuthProvider.objects.create(organization=self.org, provider="dummy")
        AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)

        status_action = {"name": "status", "value": "ignored", "type": "button"}

        resp = self.post_webhook(action_data=[status_action])
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.IGNORED

        expect_status = u"*Issue ignored by <@{}>*".format(self.identity.external_id)
        assert resp.data["text"].endswith(expect_status), resp.data["text"]

    def test_assign_issue(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.org, teams=[self.team])

        # Assign to user
        status_action = {
            "name": "assign",
            "selected_options": [{"value": u"user:{}".format(user2.id)}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=user2).exists()

        expect_status = u"*Issue assigned to {assignee} by <@{assigner}>*".format(
            assignee=user2.get_display_name(), assigner=self.identity.external_id
        )

        # Assign to team
        status_action = {
            "name": "assign",
            "selected_options": [{"value": u"team:{}".format(self.team.id)}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, team=self.team).exists()

        expect_status = u"*Issue assigned to #{team} by <@{assigner}>*".format(
            team=self.team.slug, assigner=self.identity.external_id
        )

        assert resp.data["text"].endswith(expect_status), resp.data["text"]

    def test_assign_issue_user_has_identity(self):
        user2 = self.create_user(is_superuser=False)
        self.create_member(user=user2, organization=self.org, teams=[self.team])

        user2_identity = Identity.objects.create(
            external_id="slack_id2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        status_action = {
            "name": "assign",
            "selected_options": [{"value": u"user:{}".format(user2.id)}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=user2).exists()

        expect_status = u"*Issue assigned to <@{assignee}> by <@{assigner}>*".format(
            assignee=user2_identity.external_id, assigner=self.identity.external_id
        )

        assert resp.data["text"].endswith(expect_status), resp.data["text"]

    def test_response_differs_on_bot_message(self):
        status_action = {"name": "status", "value": "ignored", "type": "button"}

        original_message = {"type": "message"}

        resp = self.post_webhook(action_data=[status_action], original_message=original_message)
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert "attachments" in resp.data
        assert resp.data["attachments"][0]["title"] == self.group1.title

    def test_assign_user_with_multiple_identities(self):
        org2 = self.create_organization(owner=None)

        integration2 = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX2",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=org2, integration=integration2)

        idp2 = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        Identity.objects.create(
            external_id="slack_id2",
            idp=idp2,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        status_action = {
            "name": "assign",
            "selected_options": [{"value": u"user:{}".format(self.user.id)}],
        }

        resp = self.post_webhook(action_data=[status_action])

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()

        expect_status = u"*Issue assigned to <@{assignee}> by <@{assignee}>*".format(
            assignee=self.identity.external_id
        )

        assert resp.data["text"].endswith(expect_status), resp.data["text"]

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
        assert data["token"][0] == self.integration.metadata["access_token"]
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group1.id
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
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.RESOLVED

        update_data = json.loads(responses.calls[1].request.body)

        expect_status = u"*Issue resolved by <@{}>*".format(self.identity.external_id)
        assert update_data["text"].endswith(expect_status)

    def test_permission_denied(self):
        user2 = self.create_user(is_superuser=False)

        user2_identity = Identity.objects.create(
            external_id="slack_id2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        status_action = {"name": "status", "value": "ignored", "type": "button"}

        resp = self.post_webhook(
            action_data=[status_action], slack_user={"id": user2_identity.external_id}
        )
        self.group1 = Group.objects.get(id=self.group1.id)

        associate_url = build_unlinking_url(
            self.integration.id, self.org.id, "slack_id2", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["response_type"] == "ephemeral"
        assert not resp.data["replace_original"]
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=user2.email, org_name=self.org.name
        )

    @responses.activate
    @patch("sentry.api.client.put")
    def test_handle_submission_fail(self, client_put):
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
        assert data["token"][0] == self.integration.metadata["access_token"]
        assert data["trigger_id"][0] == self.trigger_id
        assert "dialog" in data

        dialog = json.loads(data["dialog"][0])
        callback_data = json.loads(dialog["callback_id"])
        assert int(callback_data["issue"]) == self.group1.id
        assert callback_data["orig_response_url"] == self.response_url

        # Completing the dialog will update the message
        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # make the client raise an API error
        client_put.side_effect = client.ApiError(
            403, '{"detail":"You do not have permission to perform this action."}'
        )

        resp = self.post_webhook(
            type="dialog_submission",
            callback_id=dialog["callback_id"],
            data={"submission": {"resolve_type": "resolved"}},
        )

        client_put.asser_called()

        associate_url = build_unlinking_url(
            self.integration.id, self.org.id, "slack_id", "C065W1189", self.response_url
        )

        assert resp.status_code == 200, resp.content
        assert resp.data["text"] == UNLINK_IDENTITY_MESSAGE.format(
            associate_url=associate_url, user_email=self.user.email, org_name=self.org.name
        )

    def test_invalid_token(self):
        resp = self.post_webhook(token="invalid")
        assert resp.status_code == 401

    def test_no_integration(self):
        self.integration.delete()
        resp = self.post_webhook()
        assert resp.status_code == 403

    def test_slack_bad_payload(self):
        resp = self.client.post("/extensions/slack/action/", data={"nopayload": 0})
        assert resp.status_code == 400

    def test_sentry_docs_link_clicked(self):
        payload = {
            "token": options.get("slack.verification-token"),
            "team": {"id": "TXXXXXXX1", "domain": "example.com"},
            "user": {"id": self.identity.external_id, "domain": "example"},
            "type": "block_actions",
            "actions": [{"value": "sentry_docs_link_clicked"}],
        }
        payload = {"payload": json.dumps(payload)}

        resp = self.client.post("/extensions/slack/action/", data=payload)
        assert resp.status_code == 200
