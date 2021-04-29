from sentry.testutils import TestCase
from sentry.models import NotificationSetting, UserOption, ExternalActor, Integration
from sentry.notifications.helpers import *
from sentry.notifications.helpers import _get_setting_mapping_from_mapping
from sentry.types.integrations import ExternalProviders
from sentry.notifications.types import (
    NOTIFICATION_SETTING_DEFAULTS,
    SUBSCRIPTION_REASON_MAP,
    VALID_VALUES_FOR_KEY,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)

class NotificationHelpersTest(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.user1 = self.create_user(is_superuser=False)
        self.user2 = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.create_member(user=self.user1, organization=self.org)
        self.team = self.create_team(organization=self.org, members=[self.user1, self.user2])

        self.project = self.create_project(teams=[self.team], organization=self.org)
        group = self.create_group(project=self.project)
        self.login_as(self.user1)

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user1,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user1,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user1,
        )
        UserOption.objects.create(user=self.user1, key="self_notifications", value="1")
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.organization, self.user1)
        ExternalActor.objects.create(
            actor=self.user1.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="hellboy",
            external_id="UXXXXXXX1",
        )

    def test_get_setting_mapping_from_mapping_issue_alerts(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user1,
            NotificationSettingTypes.ISSUE_ALERTS,
        )
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS}

    def test_get_setting_mapping_from_mapping_deploy(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user1,
            NotificationSettingTypes.DEPLOY,
        )
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY}

    def test_get_setting_mapping_from_mapping_workflow(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.SUBSCRIBE_ONLY
                }
            }
        }
        mapping = _get_setting_mapping_from_mapping(
            notification_settings,
            self.user1,
            NotificationSettingTypes.WORKFLOW,
        )
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.SUBSCRIBE_ONLY}

    def test_where_should_user_be_notified(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert where_should_user_be_notified(notification_settings, self.user1) == [ExternalProviders.EMAIL]

    def test_where_should_user_be_notified_two_providers(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert where_should_user_be_notified(notification_settings, self.user1) == [ExternalProviders.EMAIL, ExternalProviders.SLACK]
    
    def test_should_be_participating(self):
        subscriptions_by_user_id = {ExternalProviders.EMAIL: {self.user1: -1}}
        assert should_be_participating(subscriptions_by_user_id, self.user1, NotificationSettingOptionValues.ALWAYS) == True

    def test_where_should_be_participating(self):
        pass

    def test_get_deploy_values_by_provider(self):
        pass

    def test_transform_to_notification_settings_by_user(self):
        pass

    def test_transform_to_notification_settings_by_parent_id(self):
        pass

    def test_validate(self):
        pass

    def test_get_scope_type(self):
        pass

    def test_get_scope(self):
        pass

    def test_get_target_id(self):
        pass

    def test_get_subscription_from_attributes(self):
        pass

    def test_get_groups_for_query(self):
        pass

    def test_collect_groups_by_project(self):
        pass

    def test_get_user_subscriptions_for_groups(self):
        pass

    def test_get_settings_by_provider(self):
        pass