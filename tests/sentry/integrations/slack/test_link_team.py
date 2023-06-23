from typing import Any, Mapping, Optional, Sequence
from urllib.parse import urlencode

import responses
from django.db.models import QuerySet
from requests import Response
from rest_framework import status

from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.models import (
    ExternalActor,
    NotificationSetting,
    Organization,
    OrganizationIntegration,
    Team,
)
from sentry.notifications.types import NotificationScopeType
from sentry.testutils import TestCase
from sentry.testutils.helpers import add_identity, get_response_text, install_slack, link_team
from sentry.testutils.silo import exempt_from_silo_limits, region_silo_test
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class SlackIntegrationLinkTeamTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.external_id = "new-slack-id"
        self.channel_name = "my-channel"
        self.channel_id = "my-channel_id"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

        responses.add(
            method=responses.POST,
            url=self.response_url,
            body='{"ok": true}',
            status=status.HTTP_200_OK,
            content_type="application/json",
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=status.HTTP_200_OK,
            content_type="application/json",
        )

    def get_success_response(self, data: Optional[Mapping[str, Any]] = None) -> Response:
        """This isn't in APITestCase so this isn't really an override."""
        kwargs = dict(content_type="application/x-www-form-urlencoded")

        if data is not None:
            response = self.client.post(self.url, urlencode(data), **kwargs)
        else:
            response = self.client.get(self.url, **kwargs)
        assert response.status_code == status.HTTP_200_OK
        return response

    def link_team(self, team: Optional["Team"] = None) -> None:
        return link_team(
            team=team or self.team,
            integration=self.integration,
            channel_name=self.channel_name,
            channel_id=self.channel_id,
        )

    def get_linked_teams(
        self, actor_ids: Optional[Sequence[int]] = None, organization: Optional[Organization] = None
    ) -> QuerySet:
        actor_ids = actor_ids or [self.team.actor_id]
        organization = organization or self.organization
        return ExternalActor.objects.filter(
            actor_id__in=actor_ids,
            organization=organization,
            integration_id=self.integration.id,
            provider=ExternalProviders.SLACK.value,
            external_name=self.channel_name,
            external_id=self.channel_id,
        )

    def _create_user_with_valid_role_through_team(self):
        user = self.create_user(email="foo@example.com")
        admin_team = self.create_team(org_role="admin")
        self.create_member(organization=self.organization, user=user, teams=[admin_team])
        self.login_as(user)


@region_silo_test(stable=True)
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

    @responses.activate
    def test_link_team(self):
        """Test that we successfully link a team to a Slack channel"""
        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/link-team.html")

        response = self.get_success_response(data={"team": self.team.id})
        self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")

        external_actors = self.get_linked_teams()
        assert len(external_actors) == 1
        assert external_actors[0].actor_id == self.team.actor_id

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team will now receive issue alert notifications in the {external_actors[0].external_name} channel."
            in get_response_text(data)
        )

        with exempt_from_silo_limits():
            team_settings = NotificationSetting.objects.filter(
                scope_type=NotificationScopeType.TEAM.value, team_id=self.team.id
            )
            assert len(team_settings) == 1

    @responses.activate
    def test_link_team_with_valid_role_through_team(self):
        """Test that we successfully link a team to a Slack channel with a valid role through a team"""
        self._create_user_with_valid_role_through_team()

        self.test_link_team()

    @responses.activate
    def test_link_team_already_linked(self):
        """Test that if a team has already been linked to a Slack channel when a user tries
        to link them again, we reject the attempt and reply with the ALREADY_LINKED_MESSAGE"""
        self.link_team()

        response = self.get_success_response(data={"team": self.team.id})
        self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")
        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"The {self.team.slug} team has already been linked to a Slack channel."
            in get_response_text(data)
        )

    def test_error_page(self):
        """Test that we successfully render an error page when bad form data is sent."""
        response = self.get_success_response(data={"team": ["some", "garbage"]})
        self.assertTemplateUsed(response, "sentry/integrations/slack/link-team-error.html")

    @responses.activate
    def test_link_team_multiple_organizations(self):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        with exempt_from_silo_limits():
            OrganizationIntegration.objects.create(
                organization_id=organization2.id, integration=self.integration
            )

        # Team order should not matter.
        for team in (self.team, team2):
            response = self.get_success_response(data={"team": team.id})
            self.assertTemplateUsed(response, "sentry/integrations/slack/post-linked-team.html")

            external_actors = self.get_linked_teams(
                organization=team.organization, actor_ids=[team.actor_id]
            )
            assert len(external_actors) == 1


@region_silo_test(stable=True)
class SlackIntegrationUnlinkTeamTest(SlackIntegrationLinkTeamTestBase):
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

    @responses.activate
    def test_unlink_team(self):
        """Test that a team can be unlinked from a Slack channel"""
        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlink-team.html")

        response = self.get_success_response(data={})
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked-team.html")

        external_actors = self.get_linked_teams()
        assert len(external_actors) == 0

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"This channel will no longer receive issue alert notifications for the {self.team.slug} team."
            in get_response_text(data)
        )

        with exempt_from_silo_limits():
            team_settings = NotificationSetting.objects.filter(
                scope_type=NotificationScopeType.TEAM.value, team_id=self.team.id
            )
        assert len(team_settings) == 0

    @responses.activate
    def test_unlink_team_with_valid_role_through_team(self):
        """Test that a team can be unlinked from a Slack channel with a valid role through a team"""
        self._create_user_with_valid_role_through_team()

        self.test_unlink_team()

    @responses.activate
    def test_unlink_multiple_teams(self):
        """
        Test that if you have linked multiple teams to a single channel, when
        you type `/sentry unlink team`, we unlink all teams from that channel.
        This should only apply to the one organization who did this before we
        blocked users from doing so.
        """
        team2 = self.create_team(organization=self.organization, name="Team Hellboy")
        self.link_team(team2)

        external_actors = self.get_linked_teams([self.team.actor_id, team2.actor_id])
        assert len(external_actors) == 2

        response = self.get_success_response()
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlink-team.html")

        response = self.get_success_response(data={})
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked-team.html")

        external_actors = self.get_linked_teams([self.team.actor_id, team2.actor_id])
        assert len(external_actors) == 0

        assert len(responses.calls) >= 1
        data = json.loads(str(responses.calls[0].request.body.decode("utf-8")))
        assert (
            f"This channel will no longer receive issue alert notifications for the {self.team.slug} team."
            in get_response_text(data)
        )

        with exempt_from_silo_limits():
            team_settings = NotificationSetting.objects.filter(
                scope_type=NotificationScopeType.TEAM.value, team_id=self.team.id
            )
        assert len(team_settings) == 0

    @responses.activate
    def test_unlink_team_multiple_organizations(self):
        # Create another organization and team for this user that is linked through `self.integration`.
        organization2 = self.create_organization(owner=self.user)
        team2 = self.create_team(organization=organization2, members=[self.user])
        with exempt_from_silo_limits():
            OrganizationIntegration.objects.create(
                organization_id=organization2.id, integration=self.integration
            )
        self.link_team(team2)

        # Team order should not matter.
        for team in (self.team, team2):
            external_actors = self.get_linked_teams(
                organization=team.organization, actor_ids=[team.actor_id]
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
                organization=team.organization, actor_ids=[team.actor_id]
            )
            assert len(external_actors) == 0
