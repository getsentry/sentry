from sentry.models import NotificationSetting
from sentry.notifications.helpers import (
    _get_setting_mapping_from_mapping,
    collect_groups_by_project,
    get_fallback_settings,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_target_id,
    get_values_by_provider_by_type,
    validate,
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

    def test_get_deploy_values_by_provider_empty_settings(self):
        values_by_provider = get_values_by_provider_by_type(
            {},
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
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

    def test_collect_groups_by_project(self):
        assert collect_groups_by_project([self.group]) == {self.project: {self.group}}

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
