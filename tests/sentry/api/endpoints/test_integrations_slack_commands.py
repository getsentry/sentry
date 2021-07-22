from typing import Any, Mapping, Optional
from urllib.parse import urlencode

import responses
from django.urls import reverse
from requests import Response
from rest_framework import status

from sentry import options
from sentry.integrations.slack.endpoints.base import NOT_LINKED_MESSAGE
from sentry.integrations.slack.endpoints.command import (
    LINK_FROM_CHANNEL_MESSAGE,
    LINK_USER_FIRST_MESSAGE,
    TEAM_NOT_LINKED_MESSAGE,
)
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.disconnected import DISCONNECTED_MESSAGE
from sentry.integrations.slack.util.auth import set_signing_secret
from sentry.integrations.slack.views.link_identity import SUCCESS_LINKED_MESSAGE, build_linking_url
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_identity import (
    SUCCESS_UNLINKED_MESSAGE,
    build_unlinking_url,
)
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    NotificationSetting,
)
from sentry.notifications.types import NotificationScopeType
from sentry.testutils import APITestCase, TestCase
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def get_response_text(data: SlackBody) -> str:
    return (
        # If it's an attachment.
        data.get("text")
        or
        # If it's blocks.
        "\n".join(block["text"]["text"] for block in data["blocks"] if block["type"] == "section")
    )


def assert_is_help_text(data: SlackBody, expected_command: Optional[str] = None) -> None:
    text = get_response_text(data)
    assert "Here are the commands you can use" in text
    if expected_command:
        assert expected_command in text


class SlackCommandsTest(APITestCase, TestCase):
    endpoint = "sentry-integration-slack-commands"
    method = "post"

    def send_slack_message(self, command: str, **kwargs: Any) -> Mapping[str, str]:
        with self.feature("organizations:notification-platform"):
            response = self.get_slack_response(
                {
                    "text": command,
                    "team_id": self.external_id,
                    "user_id": "UXXXXXXX1",
                    **kwargs,
                }
            )
        return json.loads(str(response.content.decode("utf-8")))

    def find_identity(self) -> Optional[Identity]:
        identities = Identity.objects.filter(
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
        )
        if not identities:
            return None
        return identities[0]

    def link_user(self) -> None:
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

    def link_team(self) -> None:
        ExternalActor.objects.create(
            actor_id=self.team.actor_id,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="general",
            external_id="CXXXXXXX9",
        )

    def get_slack_response(
        self, payload: Mapping[str, str], status_code: Optional[str] = None
    ) -> Response:
        """Shadow get_success_response but with a non-JSON payload."""
        data = urlencode(payload).encode("utf-8")
        response = self.client.post(
            reverse(self.endpoint),
            content_type="application/x-www-form-urlencoded",
            data=data,
            **set_signing_secret(options.get("slack.signing-secret"), data),
        )
        assert response.status_code == (status_code or status.HTTP_200_OK)
        return response

    def setUp(self):
        super().setUp()
        self.external_id = "slack:1"
        self.integration = Integration.objects.create(
            provider="slack",
            name="Slack",
            external_id=self.external_id,
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="slack:1", config={})
        self.login_as(self.user)


class SlackCommandsGetTest(SlackCommandsTest):
    method = "get"

    def test_method_get_not_allowed(self):
        self.get_error_response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)


class SlackCommandsPostTest(SlackCommandsTest):
    def test_invalid_signature(self):
        # The `get_error_response` method doesn't add a signature to the request.
        self.get_error_response(status_code=status.HTTP_400_BAD_REQUEST)

    def test_missing_team(self):
        self.get_slack_response({"text": ""}, status_code=status.HTTP_400_BAD_REQUEST)

    def test_idp_does_not_exist(self):
        """Test that get_identity fails if we cannot find a matching idp."""
        data = self.send_slack_message("", team_id="slack:2")
        assert DISCONNECTED_MESSAGE in get_response_text(data)


class SlackCommandsHelpTest(SlackCommandsTest):
    def test_missing_command(self):
        data = self.send_slack_message("")
        assert_is_help_text(data)

    def test_invalid_command(self):
        data = self.send_slack_message("invalid command")
        assert_is_help_text(data, "invalid")

    def test_help_command(self):
        data = self.send_slack_message("help")
        assert_is_help_text(data)


class SlackCommandsLinkUserTest(SlackCommandsTest):
    @responses.activate
    def test_link_user_identity(self):
        """Do the auth flow and assert that the identity was created."""
        # Assert that the identity does not exist.
        assert not self.find_identity()

        linking_url = build_linking_url(
            self.integration,
            self.organization,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "http://example.slack.com/response_url",
        )

        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        response = self.client.post(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/slack-linked.html")

        # Assert that the identity was created.
        assert self.find_identity()

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert SUCCESS_LINKED_MESSAGE in data["text"]

    @responses.activate
    def test_unlink_user_identity(self):
        self.link_user()
        assert self.find_identity()

        unlinking_url = build_unlinking_url(
            self.integration.id,
            self.organization.id,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "http://example.slack.com/response_url",
        )

        response = self.client.get(unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-unlink-identity.html")

        response = self.client.post(unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/slack-unlinked.html")

        # Assert that the identity was deleted.
        assert not self.find_identity()

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert SUCCESS_UNLINKED_MESSAGE in data["text"]

    def test_link_command(self):
        data = self.send_slack_message("link")
        assert "Link your Slack identity" in get_response_text(data)

    def test_unlink_command(self):
        self.link_user()
        data = self.send_slack_message("unlink")
        assert "to unlink your identity" in get_response_text(data)

    def test_link_command_already_linked(self):
        self.link_user()
        data = self.send_slack_message("link")
        assert "You are already linked as" in get_response_text(data)

    def test_unlink_command_already_unlinked(self):
        data = self.send_slack_message("unlink")
        assert NOT_LINKED_MESSAGE in get_response_text(data)


class SlackCommandsLinkTeamTest(SlackCommandsTest):
    def setUp(self):
        super().setUp()
        self.link_user()
        self.data = self.send_slack_message("link team")
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        self.external_actor = ExternalActor.objects.filter(
            actor_id=self.team.actor_id,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="general",
            external_id="CXXXXXXX9",
        )

    @responses.activate
    def test_link_team_command(self):
        """Test that we successfully link a team to a Slack channel"""
        assert "Link your Sentry team to this Slack channel!" in self.data["text"]
        linking_url = build_team_linking_url(
            self.integration,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-post-linked-team.html")

        assert len(self.external_actor) == 1
        assert self.external_actor[0].actor_id == self.team.actor_id

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team will now receive issue alert notifications in the {self.external_actor[0].external_name} channel."
            in data["text"]
        )

        team_settings = NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.TEAM.value, target=self.team.actor.id
        )
        assert len(team_settings) == 1

    def test_link_team_from_dm(self):
        """Test that if a user types /sentry link team from a DM instead of a channel, we reply with an error message."""
        with self.feature("organizations:notification-platform"):
            response = self.get_slack_response(
                {
                    "text": "link team",
                    "team_id": self.external_id,
                    "user_id": "UXXXXXXX2",
                    "channel_name": "directmessage",
                }
            )
        data = json.loads(str(response.content.decode("utf-8")))
        assert LINK_FROM_CHANNEL_MESSAGE in data["text"]

    def test_link_team_identity_does_not_exist(self):
        """Test that get_identity fails if the user has no Identity and we reply with the LINK_USER_MESSAGE"""
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        data = self.send_slack_message("link team", user_id="UXXXXXXX2")
        assert LINK_USER_FIRST_MESSAGE in data["text"]

    @responses.activate
    def test_link_team_insufficient_role(self):
        """Test that when a user whose role is insufficient and is a member of the
        team in question in a closed membership org attempts to link a team, we reject
        them and reply with the INSUFFICIENT_ROLE_MESSAGE"""
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        assert "Link your Sentry team to this Slack channel!" in self.data["text"]
        linking_url = build_team_linking_url(
            self.integration,
            "UXXXXXXX2",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-post-linked-team.html")

        assert len(self.external_actor) == 0

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert "You must be an admin or higher" in data["text"]

    @responses.activate
    def test_link_team_insufficient_role_open_membership(self):
        """Test that when a user whose role is insufficient in an open membership organization
        attempts to link a team, we reject them and reply with the INSUFFICIENT_ROLE_MESSAGE"""
        self.organization.flags.allow_joinleave = True
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=self.idp,
            user=user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        assert "Link your Sentry team to this Slack channel!" in self.data["text"]
        linking_url = build_team_linking_url(
            self.integration,
            "UXXXXXXX2",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-post-linked-team.html")

        assert len(self.external_actor) == 0

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert "You must be an admin or higher" in data["text"]

    @responses.activate
    def test_link_team_already_linked(self):
        """Test that if a team has already been linked to a Slack channel when a user tries
        to link them again, we reject the attempt and reply with the ALREADY_LINKED_MESSAGE"""
        ExternalActor.objects.create(
            actor_id=self.team.actor_id,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="general",
            external_id="CXXXXXXX9",
        )
        assert "Link your Sentry team to this Slack channel!" in self.data["text"]
        linking_url = build_team_linking_url(
            self.integration,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-post-linked-team.html")
        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team has already been linked to a Slack channel." in data["text"]
        )

    def test_error_page(self):
        """Test that we successfully render an error page when bad form data is sent."""
        assert "Link your Sentry team to this Slack channel!" in self.data["text"]
        linking_url = build_team_linking_url(
            self.integration,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team.html")

        data = urlencode({"team": ["some", "garbage"]})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-link-team-error.html")


class SlackCommandsUnlinkTeamTest(SlackCommandsTest):
    def setUp(self):
        super().setUp()
        self.link_user()
        self.link_team()
        self.external_actor = ExternalActor.objects.filter(
            actor_id=self.team.actor_id,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="general",
            external_id="CXXXXXXX9",
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

    @responses.activate
    def test_unlink_team(self):
        """Test that a team can be unlinked from a Slack channel"""
        data = self.send_slack_message(
            "unlink team",
            channel_name="general",
            channel_id="CXXXXXXX9",
        )
        assert "Click here to unlink your team from this channel." in data["text"]
        team_unlinking_url = build_team_unlinking_url(
            self.integration,
            self.organization.id,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(team_unlinking_url)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-unlink-team.html")

        resp = self.client.post(team_unlinking_url)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/slack-unlinked-team.html")

        assert len(self.external_actor) == 0

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"This channel will no longer receive issue alert notifications for the {self.team.slug} team."
            in data["text"]
        )

        team_settings = NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.TEAM.value, target=self.team.actor.id
        )
        assert len(team_settings) == 0

    def test_unlink_no_team(self):
        """Test for when a user attempts to remove a link between a Slack channel and a Sentry team that does not exist"""
        data = self.send_slack_message(
            "unlink team",
            channel_name="specific",
            channel_id="CXXXXXXX8",
        )
        assert TEAM_NOT_LINKED_MESSAGE in data["text"]
