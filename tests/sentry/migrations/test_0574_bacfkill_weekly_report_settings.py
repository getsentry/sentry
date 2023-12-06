from uuid import uuid4

import pytest

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("External actor replication won't work with notification settings changes")
class BackfillWeeklyReportSettingsMigrationTest(TestMigrations):
    migrate_from = "0573_add_first_seen_index_groupedmessage"
    migrate_to = "0574_backfill_weekly_report_settings"
    connection = "control"

    def setup_before_migration(self, apps):
        User = apps.get_model("sentry", "User")

        def create_user():
            email = uuid4().hex + "@example.com"
            return User.objects.create(
                email=email, username=email, is_staff=True, is_active=True, is_superuser=False
            )

        UserOption = apps.get_model("sentry", "UserOption")

        # Given: We are simulating a few UserOption records
        self.user1 = create_user()
        self.user2 = create_user()
        self.user3 = create_user()  # This user has no orgs with disabled settings
        self.org1_id = 201
        self.org2_id = 202

        UserOption.objects.create(
            user_id=self.user1.id, key="reports:disabled-organizations", value=[self.org1_id]
        )

        UserOption.objects.create(
            user_id=self.user2.id,
            key="reports:disabled-organizations",
            value=[self.org2_id, self.org1_id],
        )

        # Adding an unrelated UserOption record to ensure it's not affected
        UserOption.objects.create(user_id=self.user3.id, key="other:key", value=[self.org2_id])

    def test(self):
        # After migration, verify the NotificationSettingOption records

        notification_settings = NotificationSettingOption.objects.filter(
            user_id__in=[self.user1.id, self.user2.id, self.user3.id],
            scope_type="organization",
            type="reports",
            value="never",
        )

        self.assertEqual(notification_settings.count(), 3)

        # Checking for each user
        user1_settings = notification_settings.filter(user_id=self.user1.id)
        user2_settings = notification_settings.filter(user_id=self.user2.id)
        user3_settings = notification_settings.filter(user_id=self.user3.id)

        self.assertEqual(user1_settings.count(), 1)
        self.assertTrue(user1_settings.filter(scope_identifier=self.org1_id).exists())

        self.assertEqual(user2_settings.count(), 2)
        self.assertTrue(user2_settings.filter(scope_identifier=self.org1_id).exists())
        self.assertTrue(user2_settings.filter(scope_identifier=self.org2_id).exists())

        # User 3 should have no settings
        self.assertEqual(user3_settings.count(), 0)
