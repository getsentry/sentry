import pytest

from sentry.integrations.types import ExternalProviders, IntegrationProviderSlug
from sentry.models.team import Team
from sentry.notifications.platform.strategies.actor_routing import (
    TeamRoutingStrategy,
    UserRoutingStrategy,
)
from sentry.notifications.platform.types import NotificationProviderKey
from sentry.notifications.types import NotificationSettingEnum
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.slack import add_identity, install_slack
from sentry.users.models.user import User


class UserRoutingStrategyTest(TestCase):
    def test_multiple_users(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        self.create_member(organization=self.organization, user=user_a)
        self.create_member(organization=self.organization, user=user_b)

        targets = UserRoutingStrategy(
            project=self.project,
            user_ids=[user_a.id, user_b.id],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert {target.resource_id for target in targets} == {
            "a@example.com",
            "b@example.com",
        }

    def test_uses_project_specific_email(self) -> None:
        project_email = "project-specific@example.com"
        regular_user = self.create_user(email="regular@example.com")
        self.create_member(organization=self.organization, user=regular_user)
        self.create_useremail(user=self.user, email=project_email)
        self.create_user_option(
            user=self.user,
            project_id=self.project.id,
            key="mail:email",
            value=project_email,
        )

        targets = UserRoutingStrategy(
            project=self.project,
            user_ids=[self.user.id, regular_user.id],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        email_targets = [
            target for target in targets if target.provider_key == NotificationProviderKey.EMAIL
        ]
        assert len(email_targets) == 2
        assert {target.resource_id for target in email_targets} == {
            project_email,
            regular_user.email,
        }

    def test_uses_linked_slack_user(self) -> None:
        integration = install_slack(self.organization)
        add_identity(integration, self.user, external_id="U123")

        targets = UserRoutingStrategy(
            project=self.project,
            user_ids=[self.user.id],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        slack_targets = [
            target for target in targets if target.provider_key == NotificationProviderKey.SLACK
        ]
        assert len(slack_targets) == 1
        assert slack_targets[0].resource_id == "U123"

    def test_excludes_users_outside_organization(self) -> None:
        other_user = self.create_user(email="other@example.com")
        other_organization = self.create_organization()
        self.create_member(organization=other_organization, user=other_user)

        targets = UserRoutingStrategy(
            project=self.project,
            user_ids=[other_user.id],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert targets == []


class UserRoutingStrategyInboxTest(TestCase):
    def setUp(self) -> None:
        integration = install_slack(self.organization)
        add_identity(integration, self.user, external_id="U123")

    def _get_targets(
        self, settings_key: NotificationSettingEnum = NotificationSettingEnum.INBOX_MENTIONS
    ) -> set[tuple[NotificationProviderKey, str]]:
        targets = UserRoutingStrategy(
            organization_id=self.organization.id,
            user_ids=[self.user.id],
            settings_key=settings_key,
        ).get_targets()
        return {(target.provider_key, target.resource_id) for target in targets}

    def _set_option(self, user: User, setting: NotificationSettingEnum, value: str) -> None:
        self.create_notification_setting_option(
            user_id=user.id,
            scope_type="user",
            scope_identifier=user.id,
            type=setting.value,
            value=value,
        )

    def _set_inbox_provider(self, provider: str, value: str) -> None:
        self.create_notification_settings_provider(
            user_id=self.user.id,
            scope_type="user",
            scope_identifier=self.user.id,
            provider=provider,
            type=NotificationSettingEnum.INBOX.value,
            value=value,
        )

    def test_requires_project_or_organization(self) -> None:
        with pytest.raises(ValueError):
            UserRoutingStrategy(
                user_ids=[self.user.id], settings_key=NotificationSettingEnum.INBOX_MENTIONS
            )

    def test_defaults_to_email_and_slack(self) -> None:
        assert self._get_targets() == {
            (NotificationProviderKey.EMAIL, self.user.email),
            (NotificationProviderKey.SLACK, "U123"),
        }

    def test_category_off(self) -> None:
        self._set_option(self.user, NotificationSettingEnum.INBOX_MENTIONS, "never")

        assert self._get_targets() == set()
        assert self._get_targets(NotificationSettingEnum.INBOX_ASSIGNMENTS) == {
            (NotificationProviderKey.EMAIL, self.user.email),
            (NotificationProviderKey.SLACK, "U123"),
        }

    def test_master_setting_off(self) -> None:
        self._set_option(self.user, NotificationSettingEnum.INBOX, "never")

        assert self._get_targets() == set()

    def test_uses_master_setting_providers(self) -> None:
        self._set_inbox_provider("slack", "never")

        assert self._get_targets() == {(NotificationProviderKey.EMAIL, self.user.email)}

    def test_category_off_and_master_slack_only(self) -> None:
        self._set_inbox_provider("email", "never")
        self._set_option(self.user, NotificationSettingEnum.INBOX_PULL_REQUESTS_READY, "never")

        assert self._get_targets() == {(NotificationProviderKey.SLACK, "U123")}
        assert self._get_targets(NotificationSettingEnum.INBOX_PULL_REQUESTS_READY) == set()

    def test_settings_are_per_user(self) -> None:
        other_user = self.create_user(email="other@example.com")
        self.create_member(organization=self.organization, user=other_user)
        self._set_option(other_user, NotificationSettingEnum.INBOX_MENTIONS, "never")

        targets = UserRoutingStrategy(
            organization_id=self.organization.id,
            user_ids=[self.user.id, other_user.id],
            settings_key=NotificationSettingEnum.INBOX_MENTIONS,
        ).get_targets()

        assert {target.resource_id for target in targets} == {self.user.email, "U123"}

    def test_excludes_users_outside_organization(self) -> None:
        other_organization = self.create_organization()

        targets = UserRoutingStrategy(
            organization_id=other_organization.id,
            user_ids=[self.user.id],
            settings_key=NotificationSettingEnum.INBOX_MENTIONS,
        ).get_targets()

        assert targets == []


class TeamRoutingStrategyTest(TestCase):
    def _add_slack_route(self, team: Team, channel_id: str) -> None:
        integration, _ = self.create_provider_integration_for(
            provider=IntegrationProviderSlug.SLACK,
            organization=self.organization,
            user=self.user,
            name="test-slack",
            metadata={"domain_name": "test-workspace.slack.com"},
        )
        self.create_external_team(
            team=team,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name="test-channel",
            external_id=channel_id,
        )
        self.create_notification_settings_provider(
            team_id=team.id,
            scope_type="team",
            scope_identifier=team.id,
            provider="slack",
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value="always",
        )

    def test_falls_back_to_team_members(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=user_a)
        self.create_team_membership(team=team, user=user_b)

        targets = TeamRoutingStrategy(
            project=self.project,
            teams=[team],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert {target.resource_id for target in targets} == {
            "a@example.com",
            "b@example.com",
        }

    def test_multiple_teams_deduplicate_fallback_users(self) -> None:
        user_a = self.create_user(email="a@example.com")
        user_b = self.create_user(email="b@example.com")
        team_a = self.create_team(organization=self.organization)
        team_b = self.create_team(organization=self.organization)
        self.create_team_membership(team=team_a, user=user_a)
        self.create_team_membership(team=team_b, user=user_a)
        self.create_team_membership(team=team_b, user=user_b)

        targets = TeamRoutingStrategy(
            project=self.project,
            teams=[team_a, team_b],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert {target.resource_id for target in targets} == {
            "a@example.com",
            "b@example.com",
        }

    def test_only_unrouted_teams_fall_back_to_members(
        self,
    ) -> None:
        fallback_user = self.create_user(email="fallback@example.com")
        routed_team = self.create_team(organization=self.organization)
        fallback_team = self.create_team(organization=self.organization)
        self.create_team_membership(team=routed_team, user=self.user)
        self.create_team_membership(team=fallback_team, user=fallback_user)
        self._add_slack_route(routed_team, "C123")

        targets = TeamRoutingStrategy(
            project=self.project,
            teams=[routed_team, fallback_team],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert {(target.provider_key, target.resource_id) for target in targets} == {
            (NotificationProviderKey.SLACK, "C123"),
            (NotificationProviderKey.EMAIL, "fallback@example.com"),
        }

    def test_shared_team_route_does_not_fall_back_to_members(
        self,
    ) -> None:
        team = self.create_team(organization=self.organization)
        self.create_team_membership(team=team, user=self.user)
        self._add_slack_route(team, "C456")
        self.create_notification_settings_provider(
            team_id=team.id,
            scope_type="team",
            scope_identifier=team.id,
            provider="email",
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value="always",
        )

        targets = TeamRoutingStrategy(
            project=self.project,
            teams=[team],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert len(targets) == 1
        assert targets[0].provider_key == NotificationProviderKey.SLACK
        assert targets[0].resource_id == "C456"

    def test_excludes_teams_from_other_organizations(self) -> None:
        other_organization = self.create_organization()
        other_user = self.create_user(email="other@example.com")
        team = self.create_team(organization=other_organization)
        self.create_team_membership(team=team, user=other_user)

        targets = TeamRoutingStrategy(
            project=self.project,
            teams=[team],
            settings_key=NotificationSettingEnum.ISSUE_ALERTS,
        ).get_targets()

        assert targets == []
