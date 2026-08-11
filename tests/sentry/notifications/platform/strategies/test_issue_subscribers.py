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
from sentry.types.activity import ActivityType


class IssueSubscribersActivityStrategyTest(TestCase):
    def test_returns_empty_when_no_group(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )
        activity.group = None
        activity.save()

        strategy = IssueSubscribersActivityStrategy(activity=activity)
        assert strategy.get_targets() == []

    def test_returns_subscriber_targets(self) -> None:
        self.create_group_subscription(
            group=self.group,
            user_id=self.user.id,
            is_active=True,
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )

        strategy = IssueSubscribersActivityStrategy(activity=activity)
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
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )

        strategy = IssueSubscribersActivityStrategy(activity=activity)
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
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )

        with patch(
            "sentry.notifications.utils.participants.get_option_from_list",
            return_value="1",
        ):
            strategy = IssueSubscribersActivityStrategy(activity=activity)
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
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )

        strategy = IssueSubscribersActivityStrategy(activity=activity)
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
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )

        strategy = IssueSubscribersActivityStrategy(activity=activity)
        targets = strategy.get_targets()

        email_targets = [t for t in targets if t.provider_key == NotificationProviderKey.EMAIL]
        assert not any(t.resource_id == self.user.email for t in email_targets)
