from unittest.mock import patch

import orjson
import responses
from rest_framework import status

from sentry.integrations.slack.webhooks.command import (
    CHANNEL_ALREADY_LINKED_MESSAGE,
    INSUFFICIENT_ROLE_MESSAGE,
    LINK_FROM_CHANNEL_MESSAGE,
    LINK_USER_FIRST_MESSAGE,
    TEAM_NOT_LINKED_MESSAGE,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.helpers import get_response_text, link_user
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
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

        self.team_admin_user = self.create_user()
        self.create_member(
            team_roles=[(self.team, "admin")],
            user=self.team_admin_user,
            role="member",
            organization=self.organization,
        )


class SlackCommandsLinkTeamTest(SlackCommandsLinkTeamTestBase):
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_link_another_team_to_channel(self, mock_record):
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
        data = orjson.loads(response.content)
        assert CHANNEL_ALREADY_LINKED_MESSAGE in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @with_feature("organizations:slack-multiple-team-single-channel-linking")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @responses.activate
    def test_link_another_team_to_channel_with_flag(self, mock_record):
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
        data = orjson.loads(response.content)
        assert "Link your Sentry team to this Slack channel!" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_team_from_dm(self, mock_record):
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
        data = orjson.loads(response.content)
        assert LINK_FROM_CHANNEL_MESSAGE in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_team_identity_does_not_exist(self, mock_record):
        """Test that get_identity fails if the user has no Identity and we reply with the LINK_USER_MESSAGE"""
        user2 = self.create_user()
        self.create_member(
            teams=[self.team], user=user2, role="member", organization=self.organization
        )
        self.login_as(user2)
        data = self.send_slack_message("link team", user_id=OTHER_SLACK_ID)
        assert LINK_USER_FIRST_MESSAGE in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_team_insufficient_role(self, mock_record):
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

        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_link_team_as_team_admin(self, mock_record):
        """
        Test that when a user who is a team admin attempts to link a team we allow it.
        """
        self.login_as(self.team_admin_user)
        link_user(self.team_admin_user, self.idp, slack_id=OTHER_SLACK_ID)

        data = self.send_slack_message("link team", user_id=OTHER_SLACK_ID)
        assert "Link your Sentry team to this Slack channel!" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)


class SlackCommandsUnlinkTeamTest(SlackCommandsLinkTeamTestBase):
    def setUp(self):
        super().setUp()
        self.link_team()

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_team(self, mock_record):
        data = self.send_slack_message(
            "unlink team",
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )
        assert "Click here to unlink your team from this channel" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_team_as_team_admin(self, mock_record):
        """
        Test that when a user who is a team admin attempts to unlink a team we allow it.
        """
        self.login_as(self.team_admin_user)
        link_user(self.team_admin_user, self.idp, slack_id=OTHER_SLACK_ID)

        data = self.send_slack_message(
            "unlink team",
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )
        assert "Click here to unlink your team from this channel" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_no_team(self, mock_record):
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

        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_unlink_multiple_orgs(self, mock_record):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_organization_integration(
                organization_id=organization2.id, integration=self.integration
            )
        self.link_team(team2)

        data = self.send_slack_message(
            "unlink team",
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )
        assert "Click here to unlink your team from this channel" in get_response_text(data)

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)
