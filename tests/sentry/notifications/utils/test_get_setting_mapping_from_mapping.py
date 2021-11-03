from sentry.notifications.helpers import _get_setting_mapping_from_mapping
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class GetSettingMappingFromMappingTest(TestCase):
    def test_get_setting_mapping_from_mapping_issue_alerts(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_deploy(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.DEPLOY,
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_workflow(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.SUBSCRIBE_ONLY
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.WORKFLOW,
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_empty(self):
        mapping = _get_setting_mapping_from_mapping(
            {}, self.user, NotificationSettingTypes.ISSUE_ALERTS
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_never(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER
                }
            }
        }

        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }
