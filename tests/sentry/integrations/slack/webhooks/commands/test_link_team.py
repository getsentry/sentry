import responses
from rest_framework import status

from sentry.integrations.slack.webhooks.command import (
    CHANNEL_ALREADY_LINKED_MESSAGE,
    INSUFFICIENT_ROLE_MESSAGE,
    LINK_FROM_CHANNEL_MESSAGE,
    LINK_USER_FIRST_MESSAGE,
    TEAM_NOT_LINKED_MESSAGE,
)
from sentry.models import OrganizationIntegration
from sentry.testutils.helpers import get_response_text, link_user
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from tests.sentry.integrations.slack.webhooks.commands import SlackCommandsTest

OTHER_SLACK_ID = "UXXXXXXX2"


class SlackCommandsLinkTeamTestBase(SlackCommandsTest):
    def setUp(self):
        super().setUp()
        self.link_user()
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=status.HTTP_200_OK,
            content_type="application/json",
        )


@region_silo_test
class SlackCommandsLinkTeamTest(SlackCommandsLinkTeamTestBase):
    def test_link_another_team_to_channel(self):
        """
        Test that we block a user who tries to link a second team to a
        channel that already has a team linked to it.
        """
        self.link_team()

        response = self.get_slack_response(
            {
                "text": "link team",
                "team_id": self.external_id,
                "user_id": self.slack_id,
                "channel_name": self.channel_name,
                "channel_id": self.channel_id,
            }
        )
        data = json.loads(str(response.content.decode("utf-8")))
        assert CHANNEL_ALREADY_LINKED_MESSAGE in get_response_text(data)

    def test_link_team_from_dm(self):
        """
        Test that if a user types `/sentry link team` from a DM instead of a
        channel, we reply with an error message.
        """
        response = self.get_slack_response(
            {
                "text": "link team",
                "team_id": self.external_id,
                "user_id": OTHER_SLACK_ID,
                "channel_name": "directmessage",
            }
        )
        data = json.loads(str(response.content.decode("utf-8")))
        assert LINK_FROM_CHANNEL_MESSAGE in get_response_text(data)

    def test_link_team_identity_does_not_exist(self):
        """Test that get_identity fails if the user has no Identity and we reply with the LINK_USER_MESSAGE"""
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        data = self.send_slack_message("link team", user_id=OTHER_SLACK_ID)
        assert LINK_USER_FIRST_MESSAGE in get_response_text(data)

    @responses.activate
    def test_link_team_insufficient_role(self):
        """
        Test that when a user whose role is insufficient attempts to link a
        team, we reject them and reply with the INSUFFICIENT_ROLE_MESSAGE.
        """
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        link_user(user2, self.idp, slack_id=OTHER_SLACK_ID)

        data = self.send_slack_message("link team", user_id=OTHER_SLACK_ID)
        assert INSUFFICIENT_ROLE_MESSAGE in get_response_text(data)

    @responses.activate
    def test_link_team_sufficient_role_through_team(self):
        """
        Test that when a user whose org role is sufficient through team membership
        attempts to link a team, we allow it.
        """
        user2 = self.create_user()
        admin_team = self.create_team(org_role="admin")
        self.create_member(
            teams=[admin_team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        link_user(user2, self.idp, slack_id=OTHER_SLACK_ID)

        data = self.send_slack_message("link team", user_id=OTHER_SLACK_ID)
        assert "Link your Sentry team to this Slack channel!" in get_response_text(data)


@region_silo_test
class SlackCommandsUnlinkTeamTest(SlackCommandsLinkTeamTestBase):
    def setUp(self):
        super().setUp()
        self.link_team()

    def test_unlink_team(self):
        data = self.send_slack_message(
            "unlink team",
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )
        assert "Click here to unlink your team from this channel" in get_response_text(data)

    def test_unlink_no_team(self):
        """
        Test for when a user attempts to remove a link between a Slack channel
        and a Sentry team that does not exist.
        """
        data = self.send_slack_message(
            "unlink team",
            channel_name="specific",
            channel_id=OTHER_SLACK_ID,
        )
        assert TEAM_NOT_LINKED_MESSAGE in get_response_text(data)

    def test_unlink_multiple_orgs(self):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        OrganizationIntegration.objects.create(
            organization=organization2, integration=self.integration
        )
        self.link_team(team2)

        data = self.send_slack_message(
            "unlink team",
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )
        assert "Click here to unlink your team from this channel" in get_response_text(data)
