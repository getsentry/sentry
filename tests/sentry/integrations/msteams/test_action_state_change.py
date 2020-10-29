from __future__ import absolute_import

import responses
import time

from django.http import HttpResponse

from sentry.utils.compat.mock import patch

from sentry.models import (
    AuthProvider,
    AuthIdentity,
    Integration,
    OrganizationIntegration,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Group,
    GroupAssignee,
    GroupStatus,
)
from sentry.testutils import APITestCase
from sentry.testutils.asserts import assert_mock_called_once_with_partial
from sentry.utils import json
from sentry.integrations.msteams.card_builder import build_linking_card
from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.integrations.msteams.link_identity import build_linking_url


class BaseEventTest(APITestCase):
    def setUp(self):
        super(BaseEventTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        owner = self.create_user()
        self.org = self.create_organization(owner=owner)
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.integration = Integration.objects.create(
            provider="msteams",
            name="Fellowship of the Ring",
            external_id="f3ll0wsh1p",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "y0u_5h4ll_n07_p455",
                "expires_at": int(time.time()) + 86400,
            },
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

        self.idp = IdentityProvider.objects.create(
            type="msteams", external_id="f3ll0wsh1p", config={}
        )
        self.identity = Identity.objects.create(
            external_id="g4nd4lf",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        self.project1 = self.create_project(organization=self.org)
        self.event1 = self.store_event(data={"message": "oh no"}, project_id=self.project1.id,)
        self.group1 = self.event1.group

    def post_webhook(
        self,
        action_type="dummy",
        user_id="g4nd4lf",
        team_id="f3ll0wsh1p",
        tenant_id="m17hr4nd1r",
        conversation_type="channel",
        channel_id=None,
        group_id=None,
        resolve_input=None,
        ignore_input=None,
        assign_input=None,
    ):

        replyToId = "12345"

        channel_data = {"tenant": {"id": tenant_id}}
        if conversation_type == "channel":
            conversation_id = channel_id if channel_id else team_id
            channel_data["team"] = {"id": team_id}
            channel_data["channel"] = {"id": conversation_id}
        else:
            conversation_id = "user_conversation_id"

        responses.add(
            method=responses.PUT,
            url="https://smba.trafficmanager.net/amer/v3/conversations/%s/activities/%s"
            % (conversation_id, replyToId),
            json={},
        )

        payload = {
            "type": "message",
            "from": {"id": user_id},
            "channelData": channel_data,
            "conversation": {"conversationType": conversation_type, "id": conversation_id},
            "value": {
                "payload": {
                    "groupId": group_id or self.group1.id,
                    "eventId": self.event1.event_id,
                    "actionType": action_type,
                    "rules": [],
                    "integrationId": self.integration.id,
                },
                "resolveInput": resolve_input,
                "ignoreInput": ignore_input,
                "assignInput": assign_input,
            },
            "replyToId": replyToId,
        }

        return self.client.post("/extensions/msteams/webhook/", data=payload)


class StatusActionTest(BaseEventTest):
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_vaue=True)
    @patch("sentry.integrations.msteams.link_identity.sign")
    @responses.activate
    def test_ask_linking(self, sign, verify):
        sign.return_value = "signed_parameters"

        def user_conversation_id_callback(request):
            payload = json.loads(request.body)
            if payload["members"] == [{"id": "s4ur0n"}] and payload["channelData"] == {
                "tenant": {"id": "7h3_gr347"}
            }:
                return (200, {}, json.dumps({"id": "d4rk_l0rd"}))
            return (404, {}, json.dumps({}))

        responses.add_callback(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations",
            callback=user_conversation_id_callback,
        )

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/d4rk_l0rd/activities",
            status=200,
            json={},
        )

        resp = self.post_webhook(user_id="s4ur0n", tenant_id="7h3_gr347")

        linking_url = build_linking_url(
            self.integration, self.org, "s4ur0n", "f3ll0wsh1p", "7h3_gr347"
        )

        data = json.loads(responses.calls[1].request.body)

        assert resp.status_code == 201
        assert "attachments" in data
        assert data["attachments"][0]["content"] == build_linking_card(linking_url)

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_ignore_issue(self, verify):
        resp = self.post_webhook(action_type=ACTION_TYPE.IGNORE, ignore_input="-1")
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.IGNORED

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_ignore_issue_with_additional_user_auth(self, verify):
        auth_idp = AuthProvider.objects.create(organization=self.org, provider="nobody")
        AuthIdentity.objects.create(auth_provider=auth_idp, user=self.user)

        resp = self.post_webhook(action_type=ACTION_TYPE.IGNORE, ignore_input="-1")
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.IGNORED

    @responses.activate
    @patch("sentry.api.client.put")
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_ignore_with_params(self, verify, client_put):
        client_put.return_value = HttpResponse(status=200)
        self.post_webhook(action_type=ACTION_TYPE.IGNORE, ignore_input="100")

        expected_data = {"status": "ignored", "statusDetails": {"ignoreCount": 100}}

        assert_mock_called_once_with_partial(client_put, data=expected_data)

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_assign_to_team(self, verify):
        resp = self.post_webhook(
            action_type=ACTION_TYPE.ASSIGN, assign_input=u"team:{}".format(self.team.id)
        )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, team=self.team).exists()

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_assign_to_me(self, verify):
        resp = self.post_webhook(action_type=ACTION_TYPE.ASSIGN, assign_input="ME")

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()

        assert b"Unassign" in responses.calls[0].request.body
        assert (
            u"Assigned to {}".format(self.user.email).encode("utf-8")
            in responses.calls[0].request.body
        )

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_assign_to_me_personal_message(self, verify):
        resp = self.post_webhook(
            action_type=ACTION_TYPE.ASSIGN, assign_input="ME", conversation_type="personal"
        )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()

        assert b"Unassign" in responses.calls[0].request.body
        assert "user_conversation_id" in responses.calls[0].request.url
        assert (
            u"Assigned to {}".format(self.user.email).encode("utf-8")
            in responses.calls[0].request.body
        )

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_assign_to_me_channel_message(self, verify):
        resp = self.post_webhook(
            action_type=ACTION_TYPE.ASSIGN, assign_input="ME", channel_id="some_channel_id"
        )

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()

        assert b"Unassign" in responses.calls[0].request.body
        assert "some_channel_id" in responses.calls[0].request.url
        assert (
            u"Assigned to {}".format(self.user.email).encode("utf-8")
            in responses.calls[0].request.body
        )

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_assign_to_me_multiple_identities(self, verify):
        org2 = self.create_organization(owner=None)

        integration2 = Integration.objects.create(
            provider="msteams",
            name="Army of Mordor",
            external_id="54rum4n",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "y0u_h4v3_ch053n_d347h",
                "expires_at": int(time.time()) + 86400,
            },
        )
        OrganizationIntegration.objects.create(organization=org2, integration=integration2)

        idp2 = IdentityProvider.objects.create(type="msteams", external_id="54rum4n", config={})
        Identity.objects.create(
            external_id="7h3_gr3y",
            idp=idp2,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        resp = self.post_webhook(action_type=ACTION_TYPE.ASSIGN, assign_input="ME")

        assert resp.status_code == 200, resp.content
        assert GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_resolve_issue(self, verify):
        resp = self.post_webhook(action_type=ACTION_TYPE.RESOLVE, resolve_input="resolved")
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert self.group1.get_status() == GroupStatus.RESOLVED
        assert b"Unresolve" in responses.calls[0].request.body

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_unassign_issue(self, verify):
        GroupAssignee.objects.create(group=self.group1, project=self.project1, user=self.user)
        resp = self.post_webhook(action_type=ACTION_TYPE.UNASSIGN, resolve_input="resolved")
        self.group1 = Group.objects.get(id=self.group1.id)

        assert resp.status_code == 200, resp.content
        assert not GroupAssignee.objects.filter(group=self.group1, user=self.user).exists()
        assert b"Assign" in responses.calls[0].request.body

    @responses.activate
    @patch("sentry.api.client.put")
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_resolve_with_params(self, verify, client_put):
        client_put.return_value = HttpResponse(status=200)
        self.post_webhook(
            action_type=ACTION_TYPE.RESOLVE, resolve_input="resolved:inCurrentRelease"
        )

        expected_data = {"status": "resolved", "statusDetails": {"inRelease": "latest"}}

        assert_mock_called_once_with_partial(client_put, data=expected_data)

    @responses.activate
    @patch("sentry.integrations.msteams.webhook.verify_signature", return_value=True)
    def test_no_integration(self, verify):
        self.integration.delete()
        resp = self.post_webhook()
        assert resp.status_code == 404
