from sentry.notifications.helpers import _get_setting_mapping_from_mapping
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


@control_silo_test(stable=True)
class GetSettingMappingFromMappingTest(TestCase):
    def setUp(self):

        self.user = RpcActor.from_orm_user(self.create_user())

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
            ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
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
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
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
            ExternalProviders.SLACK: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_empty(self):
        mapping = _get_setting_mapping_from_mapping(
            {}, self.user, NotificationSettingTypes.ISSUE_ALERTS
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_slack_never(self):
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
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }

    def test_get_setting_mapping_from_mapping_slack_always(self):
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
        assert mapping[ExternalProviders.SLACK] == NotificationSettingOptionValues.NEVER

    def test_get_setting_mapping_msteams_never(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER
                }
            }
        }

        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping[ExternalProviders.MSTEAMS] == NotificationSettingOptionValues.NEVER

    def test_get_setting_mapping_msteams_always(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.MSTEAMS: NotificationSettingOptionValues.ALWAYS
                }
            }
        }

        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping[ExternalProviders.MSTEAMS] == NotificationSettingOptionValues.ALWAYS

    def test_get_setting_mapping_from_mapping_project(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                },
                NotificationScopeType.PROJECT: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
                },
            }
        }

        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER,
            ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }
