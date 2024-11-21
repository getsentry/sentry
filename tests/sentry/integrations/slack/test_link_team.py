from collections.abc import Mapping, Sequence
from typing import Any, Optional
from unittest.mock import patch
from urllib.parse import urlencode

import pytest
from django.db.models import QuerySet
from django.http.response import HttpResponseBase
from rest_framework import status
from slack_sdk.web import SlackResponse

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import add_identity, install_slack, link_team
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class SlackIntegrationLinkTeamTestBase(TestCase):
    url: str

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.external_id = "new-slack-id"
        self.channel_name = "my-channel"
        self.channel_id = "my-channel_id"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with patch(
            "slack_sdk.web.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    def get_success_response(self, data: Mapping[str, Any] | None = None) -> HttpResponseBase:
        """This isn't in APITestCase so this isn't really an override."""
        if data is not None:
            response = self.client.post(
                self.url, urlencode(data), content_type="application/x-www-form-urlencoded"
            )
        else:
            response = self.client.get(self.url, content_type="application/x-www-form-urlencoded")
        assert response.status_code == status.HTTP_200_OK
        return response

    def get_error_response(
        self,
        data: Mapping[str, Any] | None = None,
        status_code: int = status.HTTP_404_NOT_FOUND,
    ) -> HttpResponseBase:
        if data:
            response = self.client.post(
                self.url, urlencode(data), content_type="application/x-www-form-urlencoded"
            )
        else:
            response = self.client.get(self.url, content_type="application/x-www-form-urlencoded")
        assert response.status_code == status_code
        self.assertTemplateUsed(response, "sentry/integrations/generic-error.html")

        return response

    def link_team(self, team: Optional["Team"] = None) -> None:
        return link_team(
            team=team or self.team,
            integration=self.integration,
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )

    def get_linked_teams(
        self, team_ids: Sequence[int] | None = None, organization: Organization | None = None
    ) -> QuerySet:
        team_ids = team_ids or [self.team.id]
        organization = organization or self.organization
        return ExternalActor.objects.filter(
            team_id__in=team_ids,
            organization=organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name=self.channel_name,
            external_id=self.channel_id,
        )

    def _create_user_valid_through_team_admin(self):
        user = self.create_user(email="foo@example.com")
        self.create_member(
            team_roles=[(self.team, "admin")],
            user=user,
            role="member",
            organization=self.organization,
        )
        self.login_as(user)


class SlackIntegrationLinkTeamTest(SlackIntegrationLinkTeamTestBase):
    def setUp(self):
        super().setUp()
        self.url = build_team_linking_url(
            integration=self.integration,
            slack_id=self.external_id,
            channel_id=self.channel_id,
            channel_name=self.channel_name,
            response_url=self.response_url,
        )
        self.team = self.create_team(
            organization=self.organization, name="Mariachi Band", members=[self.user]
        )

    def test_link_team(self):
        """Test that we successfully link a team to a Slack channel"""
        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/link-team.html")

        response = self.get_success_response(data={"team": self.team.id})
        self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")

        external_actors = self.get_linked_teams()
        assert len(external_actors) == 1
        assert external_actors[0].team_id == self.team.id

        assert self.mock_post.call_count == 1
        text = self.mock_post.call_args.kwargs["text"]
        assert (
            f"The {self.team.slug} team will now receive issue alert notifications in the {external_actors[0].external_name} channel."
            in text
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            team_settings = NotificationSettingProvider.objects.filter(
                team_id=self.team.id,
                provider="slack",
                type="alerts",
                scope_type="team",
                scope_identifier=self.team.id,
                value="always",
            )
            assert len(team_settings) == 1

    def test_link_team_valid_through_team_admin(self):
        """Test that we successfully link a team to a Slack channel as a valid team admin"""
        self._create_user_valid_through_team_admin()

        self.test_link_team()

    def test_link_team_already_linked(self):
        """Test that if a team has already been linked to a Slack channel when a user tries
        to link them again, we reject the attempt and reply with the ALREADY_LINKED_MESSAGE"""
        self.link_team()

        response = self.get_success_response(data={"team": self.team.id})
        self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")
        assert self.mock_post.call_count == 1
        text = self.mock_post.call_args.kwargs["text"]
        assert f"The {self.team.slug} team has already been linked to a Slack channel." in text

    def test_error_page(self):
        """Test that we successfully render an error page when bad form data is sent."""
        self.get_error_response(
            data={"team": ["some", "garbage"]}, status_code=status.HTTP_400_BAD_REQUEST
        )

    def test_link_team_multiple_organizations(self):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_organization_integration(
                organization_id=organization2.id, integration=self.integration
            )

        # Team order should not matter.
        for team in (self.team, team2):
            response = self.get_success_response(data={"team": team.id})
            self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")

            external_actors = self.get_linked_teams(
                organization=team.organization, team_ids=[team.id]
            )
            assert len(external_actors) == 1

    @with_feature("organizations:team-workflow-notifications")
    def test_message_includes_workflow(self):
        self.get_success_response(data={"team": self.team.id})
        external_actors = self.get_linked_teams()

        assert self.mock_post.call_count == 1
        text = self.mock_post.call_args.kwargs["text"]
        assert (
            f"The {self.team.slug} team will now receive issue alert and workflow notifications in the {external_actors[0].external_name} channel."
            in text
        )

    @with_feature("organizations:team-workflow-notifications")
    def test_link_team_v2(self):
        """Test that we successfully link a team to a Slack channel"""
        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/link-team.html")

        response = self.get_success_response(data={"team": self.team.id})
        self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")

        external_actors = self.get_linked_teams()
        assert len(external_actors) == 1
        assert external_actors[0].team_id == self.team.id

        assert self.mock_post.call_count == 1
        text = self.mock_post.call_args.kwargs["text"]
        assert (
            f"The {self.team.slug} team will now receive issue alert and workflow notifications in the {external_actors[0].external_name} channel."
            in text
        )

        # Test that we didn't make an NotificationSetting object
        # Instead we will use the default in notificationcontroller.py
        with assume_test_silo_mode(SiloMode.CONTROL):
            team_settings = NotificationSettingProvider.objects.filter(
                team_id=self.team.id,
            )
            assert len(team_settings) == 0


class SlackIntegrationUnlinkTeamTestWithSdk(SlackIntegrationLinkTeamTestBase):
    def setUp(self):
        super().setUp()

        self.link_team()
        self.url = build_team_unlinking_url(
            integration=self.integration,
            organization_id=self.organization.id,
            slack_id=self.external_id,
            channel_id=self.channel_id,
            channel_name=self.channel_name,
            response_url=self.response_url,
        )

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self):
        with patch(
            "slack_sdk.web.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield

    def test_unlink_team(self):
        """Test that a team can be unlinked from a Slack channel"""
        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlink-team.html")

        response = self.get_success_response(data={})
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked-team.html")

        external_actors = self.get_linked_teams()
        assert len(external_actors) == 0

        assert self.mock_post.call_count == 1
        text = self.mock_post.call_args.kwargs["text"]
        assert (
            f"This channel will no longer receive issue alert notifications for the {self.team.slug} team."
            in text
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            team_settings = NotificationSettingProvider.objects.filter(team_id=self.team.id)
        assert len(team_settings) == 0

    def test_unlink_team_valid_through_team_admin(self):
        """Test that a team can be unlinked from a Slack channel as a valid team admin"""
        self._create_user_valid_through_team_admin()

        self.test_unlink_team()

    def test_unlink_multiple_teams(self):
        """
        Test that if you have linked multiple teams to a single channel, when
        you type `/sentry unlink team`, we unlink all teams from that channel.
        This should only apply to the one organization who did this before we
        blocked users from doing so.
        """
        team2 = self.create_team(organization=self.organization, name="Team Hellboy")
        self.link_team(team2)

        external_actors = self.get_linked_teams([self.team.id, team2.id])
        assert len(external_actors) == 2

        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlink-team.html")

        response = self.get_success_response(data={})
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked-team.html")

        external_actors = self.get_linked_teams([self.team.id, team2.id])
        assert len(external_actors) == 0

        assert self.mock_post.call_count >= 1
        text = self.mock_post.call_args_list[0].kwargs["text"]
        assert (
            f"This channel will no longer receive issue alert notifications for the {self.team.slug} team."
            in text
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            team_settings = NotificationSettingProvider.objects.filter(team_id=self.team.id)
        assert len(team_settings) == 0

    def test_unlink_team_multiple_organizations(self):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_organization_integration(
                organization_id=organization2.id, integration=self.integration
            )
        self.link_team(team2)

        # Team order should not matter.
        for team in (self.team, team2):
            external_actors = self.get_linked_teams(
                organization=team.organization, team_ids=[team.id]
            )
            assert len(external_actors) == 1

            # Override the URL.
            self.url = build_team_unlinking_url(
                integration=self.integration,
                organization_id=team.organization.id,
                slack_id=self.external_id,
                channel_id=self.channel_id,
                channel_name=self.channel_name,
                response_url=self.response_url,
            )
            response = self.get_success_response(data={})
            self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked-team.html")

            external_actors = self.get_linked_teams(
                organization=team.organization, team_ids=[team.id]
            )
            assert len(external_actors) == 0

    def test_unlink_team_invalid_method(self):
        """Test for an invalid method response"""
        response = self.client.put(self.url, content_type="application/x-www-form-urlencoded")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
