from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from slack_sdk.web import SlackResponse

from sentry.constants import ObjectStatus
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.slack.views import SALT
from sentry.integrations.types import ExternalProviders
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import add_identity, install_slack, link_team
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.signing import sign

SLACK_USER_ID = "UXXXXXXX1"
CHANNEL_ID = "CXXXXXXX1"
CHANNEL_NAME = "alerts"


@cell_silo_test
class OrganizationSlackLinkTeamTest(APITestCase):
    endpoint = "sentry-api-0-organization-slack-link-team"
    mock_post: MagicMock

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.team = self.create_team(organization=self.organization, members=[self.user])

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = install_slack(self.organization)
            add_identity(self.integration, self.user, SLACK_USER_ID)

        self.signed_params = sign(
            salt=SALT,
            integration_id=self.integration.id,
            slack_id=SLACK_USER_ID,
            channel_id=CHANNEL_ID,
            channel_name=CHANNEL_NAME,
            response_url="https://hooks.slack.com/commands/response",
        )

    @pytest.fixture(autouse=True)
    def mock_chat_post_message(self) -> Iterator[None]:
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

    def login_as_team_admin(self) -> None:
        team_admin = self.create_user()
        self.create_member(
            user=team_admin,
            organization=self.organization,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.create_team(organization=self.organization, members=[team_admin])
        self.login_as(team_admin)

    def linked_channels(self) -> list[tuple[str | None, str]]:
        return list(
            ExternalActor.objects.filter(
                team_id=self.team.id,
                integration_id=self.integration.id,
                provider=ExternalProviders.SLACK.value,
            ).values_list("external_id", "external_name")
        )

    def test_lists_linkable_teams(self) -> None:
        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert [team["slug"] for team in response.data] == [self.team.slug]

    def test_lists_only_administered_teams_for_team_admins(self) -> None:
        self.login_as_team_admin()

        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert [team["slug"] for team in response.data] == [self.team.slug]

    def test_lists_no_teams_for_members(self) -> None:
        member = self.create_user()
        self.create_member(
            user=member, organization=self.organization, role="member", teams=[self.team]
        )
        self.login_as(member)

        response = self.get_success_response(self.organization.slug, self.signed_params)

        assert response.data == []

    def test_rejects_an_invalid_link(self) -> None:
        self.get_error_response(self.organization.slug, "not-signed", status_code=400)

    def test_rejects_an_organization_without_the_workspace(self) -> None:
        other_org = self.create_organization(owner=self.user)

        self.get_error_response(other_org.slug, self.signed_params, status_code=404)

    def test_rejects_a_disabled_installation(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.organizationintegration_set.update(status=ObjectStatus.DISABLED)

        self.get_error_response(self.organization.slug, self.signed_params, status_code=404)

    def test_links_a_team(self) -> None:
        self.get_success_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=201,
        )

        assert self.linked_channels() == [(CHANNEL_ID, CHANNEL_NAME)]
        assert self.mock_post.call_args.kwargs["channel"] == CHANNEL_ID
        assert (
            "will now receive issue alert notifications" in self.mock_post.call_args.kwargs["text"]
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert NotificationSettingProvider.objects.filter(
                team_id=self.team.id, provider="slack", type="alerts", value="always"
            ).exists()

    def test_links_a_team_as_team_admin(self) -> None:
        self.login_as_team_admin()

        self.get_success_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=201,
        )

        assert self.linked_channels() == [(CHANNEL_ID, CHANNEL_NAME)]

    def test_reports_an_already_linked_team(self) -> None:
        link_team(self.team, self.integration, "other-channel", "CXXXXXXX2")

        response = self.get_error_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=409,
        )

        assert response.data["detail"] == (
            f"The {self.team.slug} team has already been linked to a Slack channel."
        )
        assert self.linked_channels() == [("CXXXXXXX2", "other-channel")]
        assert self.mock_post.call_args.kwargs["channel"] == CHANNEL_ID

    def test_rejects_a_team_the_user_cannot_link(self) -> None:
        other_team = self.create_team(organization=self.organization)

        self.get_error_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=other_team.id,
            status_code=403,
        )

    def test_rejects_a_token_without_team_write(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
            self.client.logout()

        self.get_error_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

        assert self.linked_channels() == []

    def test_checks_the_identity_of_the_slack_user_who_ran_the_command(self) -> None:
        other_owner = self.create_user()
        self.create_member(
            user=other_owner, organization=self.organization, role="owner", teams=[self.team]
        )
        self.login_as(other_owner)

        self.get_success_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=201,
        )

        assert self.linked_channels() == [(CHANNEL_ID, CHANNEL_NAME)]

    def test_requires_a_linked_slack_identity(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            Identity.objects.filter(user=self.user).delete()

        response = self.get_error_response(
            self.organization.slug,
            self.signed_params,
            method="post",
            team=self.team.id,
            status_code=403,
        )

        assert "/sentry link" in response.data["detail"]
        assert self.linked_channels() == []

    def test_requires_a_team(self) -> None:
        self.get_error_response(
            self.organization.slug, self.signed_params, method="post", status_code=400
        )
