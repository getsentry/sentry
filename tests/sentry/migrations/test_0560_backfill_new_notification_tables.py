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
    migrate_from = "0559_custom_dynamic_sampling_rule"
    migrate_to = "0560_backfill_new_notification_tables"
    connection = "control"

    def setup_initial_state(self):
        self.user2 = self.create_user()
        self.project2 = self.create_project()
        self.organization2 = self.create_organization()
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
                # user 1 project overrides
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.PROJECT,
                    self.project.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.PROJECT,
                    self.project2.id,
                    NotificationSettingOptionValues.NEVER,
                ),
                # user 1 organization overrides
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.DEPLOY,
                    NotificationScopeType.ORGANIZATION,
                    self.organization.id,
                    NotificationSettingOptionValues.NEVER,
                ),
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.DEPLOY,
                    NotificationScopeType.ORGANIZATION,
                    self.organization.id,
                    NotificationSettingOptionValues.COMMITTED_ONLY,
                ),
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.DEPLOY,
                    NotificationScopeType.ORGANIZATION,
                    self.organization2.id,
                    NotificationSettingOptionValues.NEVER,
                ),
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.DEPLOY,
                    NotificationScopeType.ORGANIZATION,
                    self.organization2.id,
                    NotificationSettingOptionValues.NEVER,
                ),
            ],
            user=self.user,
        )

        # update user 2 workflow
        NotificationSetting.objects.update_settings_bulk(
            [
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.USER,
                    self.user2.id,
                    NotificationSettingOptionValues.NEVER,
                ),
            ],
            user=self.user2,
        )

        # update team notification settings
        NotificationSetting.objects.update_settings_bulk(
            [
                (
                    ExternalProviders.SLACK,
                    NotificationSettingTypes.WORKFLOW,
                    NotificationScopeType.TEAM,
                    self.team.id,
                    NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                ),
            ],
            team=self.team,
            organization_id_for_team=self.organization.id,
        )

    def test(self):
        # validate the feature flag is off double writes
        assert not features.has("organizations:notifications-double-write", self.organization)
        base_user_args = {
            "scope_type": "user",
            "scope_identifier": self.user.id,
            "user_id": self.user.id,
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
        assert NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="email",
            type="workflow",
            value="never",
        ).exists()
        assert NotificationSettingProvider.objects.filter(
            **base_user_args,
            provider="slack",
            type="workflow",
            value="always",
        ).exists()
        # validate user 1 project settings
        base_project_args = {
            "scope_type": "project",
            "user_id": self.user.id,
        }
        assert NotificationSettingOption.objects.filter(
            **base_project_args,
            scope_identifier=self.project.id,
            type="workflow",
            value="always",
        ).exists()
        assert NotificationSettingOption.objects.filter(
            **base_project_args,
            scope_identifier=self.project2.id,
            type="workflow",
            value="never",
        ).exists()
        # validate user 1 organization settings
        base_org_args = {
            "scope_type": "organization",
            "user_id": self.user.id,
        }
        assert NotificationSettingOption.objects.filter(
            **base_org_args,
            scope_identifier=self.organization.id,
            type="deploy",
            value="committed_only",
        ).exists()
        assert NotificationSettingOption.objects.filter(
            **base_org_args,
            scope_identifier=self.organization2.id,
            type="deploy",
            value="never",
        ).exists()

        # validate user 2 settings
        base_user2_args = {
            "scope_type": "user",
            "scope_identifier": self.user2.id,
            "user_id": self.user2.id,
        }
        assert NotificationSettingOption.objects.filter(
            **base_user2_args,
            type="workflow",
            value="never",
        ).exists()
        assert NotificationSettingProvider.objects.filter(
            **base_user2_args,
            type="workflow",
            provider="email",
            value="never",
        ).exists()

        # validate team settings
        base_team_args = {
            "scope_type": "team",
            "scope_identifier": self.team.id,
            "team_id": self.team.id,
        }
        assert NotificationSettingOption.objects.filter(
            **base_team_args,
            type="workflow",
            value="subscribe_only",
        ).exists()
        assert NotificationSettingProvider.objects.filter(
            **base_team_args,
            type="workflow",
            provider="slack",
            value="always",
        ).exists()
        assert not NotificationSettingProvider.objects.filter(
            **base_team_args,
            type="workflow",
            provider="email",
        ).exists()
