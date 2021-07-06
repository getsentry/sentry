from sentry.models import NotificationSetting
from sentry.notifications.helpers import (
    _get_setting_mapping_from_mapping,
    collect_groups_by_project,
    get_fallback_settings,
    get_groups_for_query,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_target_id,
    get_user_subscriptions_for_groups,
    get_values_by_provider_by_type,
    should_be_participating,
    transform_to_notification_settings_by_parent_id,
    transform_to_notification_settings_by_user,
    validate,
    where_should_be_participating,
    where_should_user_be_notified,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders


class NotificationHelpersTest(TestCase):
    def setUp(self):
        super().setUp()

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

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
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS}

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
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY}

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
        assert mapping == {ExternalProviders.EMAIL: NotificationSettingOptionValues.SUBSCRIBE_ONLY}

    def test_where_should_user_be_notified(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert where_should_user_be_notified(notification_settings, self.user) == [
            ExternalProviders.EMAIL
        ]

    def test_where_should_user_be_notified_two_providers(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                }
            }
        }
        assert where_should_user_be_notified(notification_settings, self.user) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]

    def test_should_be_participating(self):
        subscriptions_by_user_id = {ExternalProviders.EMAIL: {self.user: -1}}
        self.assertTrue(
            should_be_participating(
                subscriptions_by_user_id, self.user, NotificationSettingOptionValues.ALWAYS
            )
        )

    def test_where_should_be_participating(self):
        subscriptions_by_user_id = {ExternalProviders.EMAIL: {self.user: -1}}
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert (
            where_should_be_participating(
                self.user,
                subscriptions_by_user_id,
                notification_settings,
            )
            == [ExternalProviders.EMAIL]
        )

    def test_get_deploy_values_by_provider_empty_settings(self):
        values_by_provider = get_values_by_provider_by_type(
            {}, notification_providers(), NotificationSettingTypes.DEPLOY
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
        }

    def test_get_deploy_values_by_provider(self):
        notification_settings_by_scope = {
            NotificationScopeType.ORGANIZATION: {
                ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY
            },
            NotificationScopeType.USER: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
            },
        }
        values_by_provider = get_values_by_provider_by_type(
            notification_settings_by_scope,
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
        }

    def test_transform_to_notification_settings_by_user(self):
        notification_settings = NotificationSetting.objects.get_for_recipient_by_parent(
            NotificationSettingTypes.WORKFLOW,
            recipients=[self.user],
            parent=self.group.project,
        )
        notification_settings_by_user = transform_to_notification_settings_by_user(
            notification_settings, [self.user]
        )
        assert notification_settings_by_user == {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS
                }
            }
        }

    def test_transform_to_notification_settings_by_parent_id(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            project=self.project,
        )
        notification_settings = NotificationSetting.objects.get_for_user_by_projects(
            NotificationSettingTypes.WORKFLOW,
            self.user,
            [self.project],
        )
        (
            notification_settings_by_project_id_by_provider,
            default_subscribe_by_provider,
        ) = transform_to_notification_settings_by_parent_id(
            notification_settings, NotificationSettingOptionValues.ALWAYS
        )
        assert notification_settings_by_project_id_by_provider == {
            ExternalProviders.SLACK: {self.project.id: NotificationSettingOptionValues.ALWAYS}
        }
        assert default_subscribe_by_provider == {
            ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS
        }

    def test_validate(self):
        self.assertTrue(
            validate(NotificationSettingTypes.ISSUE_ALERTS, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.ISSUE_ALERTS, NotificationSettingOptionValues.NEVER)
        )

        self.assertTrue(
            validate(NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.NEVER)
        )
        self.assertTrue(
            validate(
                NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.COMMITTED_ONLY
            )
        )
        self.assertFalse(
            validate(
                NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.SUBSCRIBE_ONLY
            )
        )

        self.assertTrue(
            validate(NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.NEVER)
        )
        self.assertTrue(
            validate(
                NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.SUBSCRIBE_ONLY
            )
        )
        self.assertFalse(
            validate(
                NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.COMMITTED_ONLY
            )
        )

    def test_get_scope_type(self):
        assert get_scope_type(NotificationSettingTypes.DEPLOY) == NotificationScopeType.ORGANIZATION
        assert get_scope_type(NotificationSettingTypes.WORKFLOW) == NotificationScopeType.PROJECT
        assert (
            get_scope_type(NotificationSettingTypes.ISSUE_ALERTS) == NotificationScopeType.PROJECT
        )
        assert not get_scope_type(NotificationSettingTypes.DEPLOY) == NotificationScopeType.PROJECT
        assert (
            not get_scope_type(NotificationSettingTypes.WORKFLOW)
            == NotificationScopeType.ORGANIZATION
        )
        assert (
            not get_scope_type(NotificationSettingTypes.ISSUE_ALERTS)
            == NotificationScopeType.ORGANIZATION
        )

    def test_get_target_id(self):
        assert get_target_id(self.user) == self.user.actor_id
        assert get_target_id(self.team) == self.team.actor_id

    def test_get_subscription_from_attributes(self):
        attrs = {"subscription": (True, True, None)}
        assert get_subscription_from_attributes(attrs) == (True, {"disabled": True})

        attrs = {"subscription": (True, False, None)}
        assert get_subscription_from_attributes(attrs) == (False, {"disabled": True})

    def test_get_groups_for_query(self):
        groups_by_project = {self.project: {self.group}}
        notification_settings_by_key = {5: NotificationSettingOptionValues.ALWAYS}
        global_default_workflow_option = NotificationSettingOptionValues.ALWAYS
        query_groups = get_groups_for_query(
            groups_by_project,
            notification_settings_by_key,
            global_default_workflow_option,
        )
        assert query_groups == {self.group}

    def test_collect_groups_by_project(self):
        assert collect_groups_by_project([self.group]) == {self.project: {self.group}}

    def test_get_user_subscriptions_for_groups(self):
        groups_by_project = {self.project: {self.group}}
        notification_settings_by_key = {5: NotificationSettingOptionValues.ALWAYS}
        subscriptions_by_group_id = {2: None}
        global_default_workflow_option = NotificationSettingOptionValues.ALWAYS
        subscriptions = get_user_subscriptions_for_groups(
            groups_by_project,
            notification_settings_by_key,
            subscriptions_by_group_id,
            global_default_workflow_option,
        )
        assert subscriptions == {self.group.id: (False, True, None)}

    def test_get_settings_by_provider(self):
        settings = {
            NotificationScopeType.USER: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER
            }
        }
        assert get_settings_by_provider(settings) == {
            ExternalProviders.EMAIL: {
                NotificationScopeType.USER: NotificationSettingOptionValues.NEVER
            }
        }

    def test_get_fallback_settings_minimal(self):
        assert get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {}, {}) == {}

    def test_get_fallback_settings_user(self):
        data = get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {}, {}, self.user)
        assert data == {
            "alerts": {
                "user": {
                    self.user.id: {
                        "email": "always",
                        "slack": "never",
                    }
                }
            }
        }

    def test_get_fallback_settings_projects(self):
        data = get_fallback_settings({NotificationSettingTypes.ISSUE_ALERTS}, {self.project.id}, {})
        assert data == {
            "alerts": {
                "project": {
                    self.project.id: {
                        "email": "default",
                        "slack": "default",
                    }
                }
            }
        }
