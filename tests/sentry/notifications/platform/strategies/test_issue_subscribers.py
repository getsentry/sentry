from unittest.mock import patch

from sentry.notifications.platform.strategies.issue_subscribers import (
    IssueSubscribersActivityStrategy,
)
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase


class IssueSubscribersActivityStrategyTest(TestCase):
    def test_returns_empty_when_no_group(self) -> None:
        strategy = IssueSubscribersActivityStrategy(group=None, actor_user_id=None)
        assert strategy.get_targets() == []

    def test_returns_subscriber_targets(self) -> None:
        self.create_group_subscription(
            group=self.group,
            user_id=self.user.id,
            is_active=True,
        )
        strategy = IssueSubscribersActivityStrategy(group=self.group, actor_user_id=None)
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert len(email_targets) >= 1
        assert any(
            isinstance(t, GenericNotificationTarget)
            and t.resource_type == NotificationTargetResourceType.EMAIL
            and t.resource_id == self.user.email
            for t in email_targets
        )

    def test_excludes_activity_author_by_default(self) -> None:
        self.create_group_subscription(
            group=self.group,
            user_id=self.user.id,
            is_active=True,
        )
        strategy = IssueSubscribersActivityStrategy(group=self.group, actor_user_id=self.user.id)
        targets = strategy.get_targets()

        assert not any(
            t.resource_id == self.user.email
            for t in targets
            if t.provider_key == NotificationProviderKey.EMAIL
        )

    def test_includes_activity_author_when_self_notifications_enabled(self) -> None:
        self.create_group_subscription(
            group=self.group,
            user_id=self.user.id,
            is_active=True,
        )
        with patch(
            "sentry.notifications.utils.participants.get_option_from_list",
            return_value="1",
        ):
            strategy = IssueSubscribersActivityStrategy(
                group=self.group, actor_user_id=self.user.id
            )
            targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert any(t.resource_id == self.user.email for t in email_targets)

    def test_multiple_subscribers(self) -> None:
        user_b = self.create_user(email="b@example.com")
        self.create_member(organization=self.organization, user=user_b, teams=[self.team])
        for u in (self.user, user_b):
            self.create_group_subscription(
                group=self.group,
                user_id=u.id,
                is_active=True,
            )
        strategy = IssueSubscribersActivityStrategy(group=self.group, actor_user_id=None)
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        emails = {t.resource_id for t in email_targets}
        assert self.user.email in emails
        assert "b@example.com" in emails

    def test_unsubscribed_user_excluded(self) -> None:
        self.create_group_subscription(
            group=self.group,
            user_id=self.user.id,
            is_active=False,
        )
        strategy = IssueSubscribersActivityStrategy(group=self.group, actor_user_id=None)
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert not any(t.resource_id == self.user.email for t in email_targets)
