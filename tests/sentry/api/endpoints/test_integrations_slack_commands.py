from typing import Mapping, Optional
from urllib.parse import urlencode

import responses
from django.urls import reverse
from requests import Response
from rest_framework import status

from sentry import options
from sentry.integrations.slack.command_endpoint import LINK_USER_MESSAGE
from sentry.integrations.slack.link_team import build_linking_url
from sentry.integrations.slack.util.auth import set_signing_secret
from sentry.models import ExternalActor, Identity, IdentityProvider, IdentityStatus, Integration
from sentry.testutils import APITestCase, TestCase
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def assert_is_help_text(response: Response, expected_command: Optional[str] = None) -> None:
    data = json.loads(str(response.content.decode("utf-8")))
    assert "Available Commands" in data["text"]
    if expected_command:
        assert expected_command in data["text"]


class SlackCommandsTest(APITestCase, TestCase):
    endpoint = "sentry-integration-slack-commands"

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


class SlackCommandsGetTest(SlackCommandsTest):
    def test_method_get_not_allowed(self):
        self.get_error_response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)


class SlackCommandsHelpTest(SlackCommandsTest):
    method = "post"

    def test_invalid_signature(self):
        # The `get_error_response` method doesn't use a signature.
        self.get_error_response(status_code=status.HTTP_400_BAD_REQUEST)

    def test_missing_team(self):
        self.get_slack_response({"text": ""}, status_code=status.HTTP_403_FORBIDDEN)

    def test_missing_command(self):
        response = self.get_slack_response({"text": "", "team_id": self.external_id})
        assert_is_help_text(response)

    def test_invalid_command(self):
        response = self.get_slack_response({"text": "invalid command", "team_id": self.external_id})
        assert_is_help_text(response, "invalid")

    def test_help_command(self):
        response = self.get_slack_response({"text": "help", "team_id": self.external_id})
        assert_is_help_text(response)


class SlackCommandsLinkTeamTest(SlackCommandsTest):
    method = "post"

    def setUp(self):
        super().setUp()
        self.idp = IdentityProvider.objects.create(type="slack", external_id="slack:1", config={})
        self.login_as(self.user)
        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        response = self.get_slack_response(
            {"text": "link team", "team_id": self.external_id, "user_id": "UXXXXXXX1"}
        )
        self.data = json.loads(str(response.content.decode("utf-8")))
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
        linking_url = build_linking_url(
            self.integration,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-post-linked-team.html")

        assert len(self.external_actor) == 1
        assert self.external_actor[0].actor_id == self.team.actor_id

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team will now receive issue alert notifications in the {self.external_actor[0].external_name} channel."
            in data["text"]
        )

    def test_link_team_idp_does_not_exist(self):
        """Test that get_identity fails if we cannot find a matching idp"""
        self.get_slack_response(
            {"text": "link team", "team_id": "slack:2", "user_id": "UA1J9RTE1"},
            status_code=403,
        )

    def test_link_team_identity_does_not_exist(self):
        """Test that get_identity fails if the user has no Identity and we reply with the LINK_USER_MESSAGE"""
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        response = self.get_slack_response(
            {"text": "link team", "team_id": self.external_id, "user_id": "UXXXXXXX2"}
        )
        data = json.loads(str(response.content.decode("utf-8")))
        assert LINK_USER_MESSAGE in data["text"]

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
        linking_url = build_linking_url(
            self.integration,
            "UXXXXXXX2",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-post-linked-team.html")

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
        linking_url = build_linking_url(
            self.integration,
            "UXXXXXXX2",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-post-linked-team.html")

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
        linking_url = build_linking_url(
            self.integration,
            "UXXXXXXX1",
            "CXXXXXXX9",
            "general",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-link-team.html")

        data = urlencode({"team": self.team.id})
        resp = self.client.post(linking_url, data, content_type="application/x-www-form-urlencoded")
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/slack-post-linked-team.html")
        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team has already been linked to a Slack channel." in data["text"]
        )
