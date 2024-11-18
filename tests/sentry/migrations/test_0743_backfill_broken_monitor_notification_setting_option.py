from uuid import uuid4

import pytest

from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import control_silo_test


@control_silo_test
@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillBrokenMonitorNotificationSettingOptionTest(TestMigrations):
    migrate_from = "0742_backfill_alertrule_detection_type"
    migrate_to = "0743_backfill_broken_monitor_notification_setting_option"
    connection = "control"

    def setup_before_migration(self, apps):
        NotificationSettingOptionModel = apps.get_model("sentry", "NotificationSettingOption")
        User = apps.get_model("sentry", "User")

        def create_user():
            email = uuid4().hex + "@example.com"
            return User.objects.create(
                email=email, username=email, is_staff=True, is_active=True, is_superuser=False
            )

        self.user1 = create_user()
        NotificationSettingOptionModel.objects.create(
            user_id=self.user1.id,
            scope_type="user",
            scope_identifier=self.user1.id,
            type="approval",
            value="never",
        )
        self.user2 = create_user()
        NotificationSettingOptionModel.objects.create(
            user_id=self.user2.id,
            scope_type="user",
            scope_identifier=self.user2.id,
            type="approval",
            value="always",
        )
        # Test that an existing brokenMonitors row isn't duplicated or overridden
        self.user3 = create_user()
        NotificationSettingOptionModel.objects.create(
            user_id=self.user3.id,
            scope_type="user",
            scope_identifier=self.user3.id,
            type="brokenMonitors",
            value="always",
        )
        NotificationSettingOptionModel.objects.create(
            user_id=self.user3.id,
            scope_type="user",
            scope_identifier=self.user3.id,
            type="approval",
            value="never",
        )

    def test(self):
        broken_notifs = NotificationSettingOption.objects.filter(type="brokenMonitors")
        assert broken_notifs.count() == 3

        never_notif = broken_notifs.get(user_id=self.user1.id)
        assert never_notif.value == "never"
        assert never_notif.user_id == self.user1.id
        assert never_notif.scope_type == "user"
        assert never_notif.scope_identifier == self.user1.id

        always_notif = broken_notifs.get(user_id=self.user2.id)
        assert always_notif.value == "always"
        assert always_notif.user_id == self.user2.id
        assert always_notif.scope_type == "user"
        assert always_notif.scope_identifier == self.user2.id

        existing_notif = broken_notifs.get(user_id=self.user3.id)
        assert existing_notif.value == "always"
        assert existing_notif.user_id == self.user3.id
        assert existing_notif.scope_type == "user"
        assert existing_notif.scope_identifier == self.user3.id
