import pytest

from sentry.testutils.cases import TestMigrations
from sentry.uptime.models import ProjectUptimeSubscriptionMode, UptimeSubscription


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class UpdateAutoDetectedActiveIntervalSecondsTest(TestMigrations):
    migrate_from = "0006_projectuptimesubscription_name_owner"
    migrate_to = "0007_update_detected_subscription_interval"
    app = "uptime"

    def setup_before_migration(self, apps):
        self.uptime_subscription = self.create_uptime_subscription(
            url="http://sintry.io", interval_seconds=300
        )
        self.create_project_uptime_subscription(
            uptime_subscription=self.uptime_subscription,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )

        self.uptime_subscription_unchanged = self.create_uptime_subscription(
            url="http://santry.io", interval_seconds=300
        )
        self.create_project_uptime_subscription(
            uptime_subscription=self.uptime_subscription_unchanged,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
        )

        self.uptime_subscription_unchanged_2 = self.create_uptime_subscription(
            url="http://sontry.io", interval_seconds=300
        )
        self.create_project_uptime_subscription(
            uptime_subscription=self.uptime_subscription_unchanged_2,
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
        )

    def test(self):
        self.uptime_subscription.refresh_from_db()
        assert self.uptime_subscription.interval_seconds == 60
        assert self.uptime_subscription.status == UptimeSubscription.Status.CREATING.value
        self.uptime_subscription_unchanged.refresh_from_db()
        assert self.uptime_subscription_unchanged.interval_seconds == 300
        assert self.uptime_subscription_unchanged.status == UptimeSubscription.Status.ACTIVE.value
        self.uptime_subscription_unchanged_2.refresh_from_db()
        assert self.uptime_subscription_unchanged_2.interval_seconds == 300
        assert self.uptime_subscription_unchanged_2.status == UptimeSubscription.Status.ACTIVE.value
