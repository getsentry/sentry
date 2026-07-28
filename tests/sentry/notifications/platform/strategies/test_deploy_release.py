from typing import Any

from sentry.notifications.platform.strategies.deploy_release import DeployReleaseStrategy
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.notifications.types import (
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.testutils.cases import TestCase


class DeployReleaseStrategyTest(TestCase):
    def _make_strategy(self, **overrides: Any) -> DeployReleaseStrategy:
        defaults = dict(
            projects=frozenset([self.project]),
            organization=self.organization,
            committer_user_ids=frozenset(),
        )
        defaults.update(overrides)
        return DeployReleaseStrategy(**defaults)

    def _set_deploy_setting(
        self, option: NotificationSettingsOptionEnum, user_id: int | None = None
    ) -> None:
        self.create_notification_setting_option(
            scope_type="user",
            scope_identifier=user_id or self.user.id,
            user_id=user_id or self.user.id,
            type=NotificationSettingEnum.DEPLOY.value,
            value=option.value,
        )

    def test_returns_empty_when_no_users_on_project_teams(self) -> None:
        empty_project = self.create_project(organization=self.organization, teams=[])
        strategy = self._make_strategy(projects=frozenset([empty_project]))
        assert strategy.get_targets() == []

    def test_returns_email_target_for_always_subscriber(self) -> None:
        self._set_deploy_setting(NotificationSettingsOptionEnum.ALWAYS)

        strategy = self._make_strategy()
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert len(email_targets) == 1
        assert email_targets[0].resource_type == NotificationTargetResourceType.EMAIL
        assert email_targets[0].resource_id == self.user.email
        assert email_targets[0].specific_data == {"user_id": self.user.id}

    def test_returns_email_target_for_committer_with_committed_only(self) -> None:
        self._set_deploy_setting(NotificationSettingsOptionEnum.COMMITTED_ONLY)

        strategy = self._make_strategy(committer_user_ids=frozenset([self.user.id]))
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert len(email_targets) == 1
        assert email_targets[0].resource_id == self.user.email

    def test_excludes_non_committer_with_committed_only(self) -> None:
        self._set_deploy_setting(NotificationSettingsOptionEnum.COMMITTED_ONLY)

        strategy = self._make_strategy(committer_user_ids=frozenset())
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert not any(t.resource_id == self.user.email for t in email_targets)

    def test_excludes_user_with_never_setting(self) -> None:
        self._set_deploy_setting(NotificationSettingsOptionEnum.NEVER)

        strategy = self._make_strategy(committer_user_ids=frozenset([self.user.id]))
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert not any(t.resource_id == self.user.email for t in email_targets)

    def test_multiple_users_across_projects(self) -> None:
        user_b = self.create_user(email="b@example.com")
        team_b = self.create_team(organization=self.organization)
        self.create_member(organization=self.organization, user=user_b, teams=[team_b])
        project_b = self.create_project(organization=self.organization, teams=[team_b])

        for user_id in (self.user.id, user_b.id):
            self._set_deploy_setting(NotificationSettingsOptionEnum.ALWAYS, user_id=user_id)

        strategy = self._make_strategy(projects=frozenset([self.project, project_b]))
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        emails = {t.resource_id for t in email_targets}
        assert self.user.email in emails
        assert "b@example.com" in emails
