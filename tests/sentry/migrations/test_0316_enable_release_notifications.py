from sentry.models import NotificationSetting, Organization
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils.cases import TestMigrations
from sentry.types.integrations import ExternalProviders


class TestBackfill(TestMigrations):
    migrate_from = "0315_add_type_to_group"
    migrate_to = "0316_enable_release_notifications"

    def setup_before_migration(self, apps):
        self.user1 = self.create_user()
        sentry_org = Organization.objects.filter(id=1)
        if sentry_org.exists():
            self.create_member(organization=sentry_org.first(), user=self.user1)
        self.user2 = self.create_user()
        self.orgB = self.create_organization(owner=self.user2)

    def test(self):
        assert NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user1.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.ACTIVE_RELEASE.value,
            scope_identifier=self.user1.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        ).exists()

        assert NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user1.actor_id,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.ACTIVE_RELEASE.value,
            scope_identifier=self.user1.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        ).exists()

        # only users in the Sentry org should have the notifications enabled
        assert not NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user2.actor_id,
            provider=ExternalProviders.SLACK.value,
            type=NotificationSettingTypes.ACTIVE_RELEASE.value,
            scope_identifier=self.user2.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        ).exists()

        assert not NotificationSetting.objects.filter(
            scope_type=NotificationScopeType.USER.value,
            target_id=self.user2.actor_id,
            provider=ExternalProviders.EMAIL.value,
            type=NotificationSettingTypes.ACTIVE_RELEASE.value,
            scope_identifier=self.user2.id,
            value=NotificationSettingOptionValues.ALWAYS.value,
        ).exists()
