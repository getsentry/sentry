from sentry import features
from sentry.models import (
    NotificationSetting,
    NotificationSettingOption,
    NotificationSettingProvider,
)
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils.cases import TestMigrations
from sentry.types.integrations import ExternalProviders


class BackfillNewNotificationTables(TestMigrations):
    migrate_from = "0554_add_team_replica"
    migrate_to = "0555_backfill_new_notification_tables"

    def setup_initial_state(self):
        print("setup_initial_state")
        NotificationSetting.objects.update_settings_bulk(
            [
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.ISSUE_ALERTS,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                ),
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.NEVER,
                ),
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.QUOTA,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
            ],
            user=self.user,
        )

    def test(self):
        NotificationSettingOption2 = self.apps.get_model("sentry", "NotificationSettingOption")
        print("all", NotificationSettingOption.objects.all())
        print("all", NotificationSettingOption2.objects.all())

        # validate the feature flag is off double writes
        assert not features.has("organizations:notifications-double-write", self.organization)
        base_user_args = {
            "scope_type": NotificationScopeType.USER,
            "scope_identifier": self.user.id,
        }
        # validate user 1 alert settings
        assert NotificationSettingOption.objects.filter(
            **base_user_args,
            type="alerts",
            value="always",
        ).exists()
        assert NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="email",
            type="alerts",
            value="always",
        ).exists()
        assert not NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="slack",
            type="alerts",
        ).exists()

        # validate user 1 workflow settings
        assert NotificationSettingOption.objects.filter(
            **base_user_args,
            type="workflow",
            value="subscribe_only",
        ).exists()
        assert not NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="email",
            type="workflow",
        ).exists()
        assert NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="slack",
            type="wor",
            value="always",
        ).exists()
