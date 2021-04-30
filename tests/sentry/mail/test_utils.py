from sentry.models import ExternalActor, Integration, NotificationSetting, UserOption
from sentry.notifications.helpers import (
    _get_setting_mapping_from_mapping,
    collect_groups_by_project,
    get_deploy_values_by_provider,
    get_groups_for_query,
    get_scope,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_target_id,
    get_user_subscriptions_for_groups,
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
        super(TestCase, self).setUp()
        self.user1 = self.create_user(is_superuser=False)
        self.user2 = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.create_member(user=self.user1, organization=self.org)
        self.team = self.create_team(organization=self.org, members=[self.user1, self.user2])

        self.project = self.create_project(teams=[self.team], organization=self.org)
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
        assert where_should_user_be_notified(notification_settings, self.user1) == [
            ExternalProviders.EMAIL
        ]

    def test_where_should_user_be_notified_two_providers(self):
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                }
            }
        }
        assert where_should_user_be_notified(notification_settings, self.user1) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]

    def test_should_be_participating(self):
        subscriptions_by_user_id = {ExternalProviders.EMAIL: {self.user1: -1}}
        self.assertTrue(
            should_be_participating(
                subscriptions_by_user_id, self.user1, NotificationSettingOptionValues.ALWAYS
            )
        )

    def test_where_should_be_participating(self):
        subscriptions_by_user_id = {ExternalProviders.EMAIL: {self.user1: -1}}
        notification_settings = {
            self.user1: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert (
            where_should_be_participating(
                self.user1,
                subscriptions_by_user_id,
                notification_settings,
            )
            == [ExternalProviders.EMAIL]
        )

    def test_get_deploy_values_by_provider(self):
        notification_settings_by_scope = {
            NotificationScopeType.ORGANIZATION: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY
            },
            NotificationScopeType.USER: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
            },
        }
        values_by_provider = get_deploy_values_by_provider(
            notification_settings_by_scope, notification_providers()
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
        }

    def test_transform_to_notification_settings_by_user(self):
        notification_settings = NotificationSetting.objects.get_for_users_by_parent(
            NotificationSettingTypes.WORKFLOW,
            users=[self.user1],
            parent=self.group.project,
        )
        notification_settings_by_user = transform_to_notification_settings_by_user(
            notification_settings, [self.user1]
        )
        assert notification_settings_by_user == {
            self.user1: {
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
            user=self.user1,
            project=self.project,
        )
        notification_settings = NotificationSetting.objects.get_for_user_by_projects(
            NotificationSettingTypes.WORKFLOW,
            self.user1,
            [self.project],
        )
        (
            notification_settings_by_project_id_by_provider,
            default_subscribe_by_provider,
        ) = transform_to_notification_settings_by_parent_id(
            notification_settings, NotificationSettingOptionValues.ALWAYS
        )
        assert notification_settings_by_project_id_by_provider == {
            ExternalProviders.SLACK: {15: NotificationSettingOptionValues.ALWAYS}
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

    def test_get_scope(self):
        scope_type, scope_identifier = get_scope(self.user1.id, project=None, organization=None)
        assert scope_type == NotificationScopeType.USER
        assert scope_identifier == self.user1.id

        scope_type, scope_identifier = get_scope(
            self.user1.id, project=self.project, organization=None
        )
        assert scope_type == NotificationScopeType.PROJECT
        assert scope_identifier == self.project.id

        scope_type, scope_identifier = get_scope(self.user1.id, project=None, organization=self.org)
        assert scope_type == NotificationScopeType.ORGANIZATION
        assert scope_identifier == self.org.id

    def test_get_target_id(self):
        assert get_target_id(self.user1) == self.user1.actor_id
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
