from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.models.team import Team
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    GroupSubscriptionStatus,
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import link_team
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.actor import Actor, ActorType


def add_notification_setting_option(
    scope_type,
    scope_identifier,
    type,
    value,
    user_id=None,
    team_id=None,
):
    return NotificationSettingOption.objects.create(
        scope_type=scope_type.value,
        scope_identifier=scope_identifier,
        type=type.value,
        value=value.value,
        user_id=user_id,
        team_id=team_id,
    )


def add_notification_setting_provider(
    scope_type,
    scope_identifier,
    provider,
    type,
    value,
    user_id=None,
    team_id=None,
):
    return NotificationSettingProvider.objects.create(
        scope_type=scope_type.value,
        scope_identifier=scope_identifier,
        provider=provider.value,
        type=type.value,
        value=value.value,
        user_id=user_id,
        team_id=team_id,
    )


# The tests below are intended to check behavior with the new
# NotificationSettingOption and NotificationSettingProvider tables
@control_silo_test
class NotificationControllerTest(TestCase):
    def setUp(self):
        super().setUp()
        setting_option_1 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.DEPLOY,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        setting_option_2 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        setting_option_3 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )

        self.setting_options = [setting_option_1, setting_option_2, setting_option_3]

        setting_provider_1 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.SLACK,
            type=NotificationSettingEnum.DEPLOY,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        setting_provider_2 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            provider=ExternalProviderEnum.MSTEAMS,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )
        setting_provider_3 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )

        self.setting_providers = [setting_provider_1, setting_provider_2, setting_provider_3]

    def test_get_all_setting_options(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        assert list(controller.get_all_setting_options) == self.setting_options

        NotificationSettingOption.objects.all().delete()
        assert list(controller.get_all_setting_options) == self.setting_options
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        assert list(controller.get_all_setting_options) == []

    def test_get_all_setting_providers(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        assert list(controller.get_all_setting_providers) == self.setting_providers

    def test_without_settings(self):
        rpc_user = Actor.from_object(self.user)
        NotificationSettingOption.objects.all().delete()
        NotificationSettingProvider.objects.all().delete()
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        assert controller.get_all_setting_options == []
        assert controller.get_all_setting_providers == []
        options = controller._get_layered_setting_options()
        assert (
            options[self.user][NotificationSettingEnum.ISSUE_ALERTS]
            == NotificationSettingsOptionEnum.ALWAYS
        )
        providers = controller._get_layered_setting_providers()
        assert (
            providers[self.user][NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS.value
            ]
            == NotificationSettingsOptionEnum.NEVER
        )
        assert (
            providers[self.user][NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK.value]
            == NotificationSettingsOptionEnum.COMMITTED_ONLY
        )

        enabled_settings = controller.get_combined_settings()[self.user]
        assert (
            enabled_settings[NotificationSettingEnum.ISSUE_ALERTS][ExternalProviderEnum.SLACK.value]
            == NotificationSettingsOptionEnum.ALWAYS
        )
        assert controller.get_notification_recipients(
            type=NotificationSettingEnum.ISSUE_ALERTS
        ) == {ExternalProviders.EMAIL: {rpc_user}, ExternalProviders.SLACK: {rpc_user}}
        assert not controller.user_has_any_provider_settings(provider=ExternalProviderEnum.SLACK)
        assert not controller.user_has_any_provider_settings(provider=ExternalProviderEnum.MSTEAMS)

    def test_filter_setting_options(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        filtered_options = controller._filter_options(type=NotificationSettingEnum.DEPLOY.value)
        assert filtered_options == [self.setting_options[0]]

        filtered_options = controller._filter_options(
            type=NotificationSettingEnum.ISSUE_ALERTS.value
        )
        assert filtered_options == self.setting_options[1:]

        filtered_options = controller._filter_options(
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            scope_type=NotificationScopeEnum.PROJECT.value,
        )
        assert filtered_options == [self.setting_options[1]]

    def test_filter_setting_providers(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        filtered_providers = controller._filter_providers(type=NotificationSettingEnum.DEPLOY.value)
        assert filtered_providers == [self.setting_providers[0]]

        filtered_providers = controller._filter_providers(
            value=NotificationSettingsOptionEnum.ALWAYS.value
        )
        assert filtered_providers == [self.setting_providers[0], self.setting_providers[2]]

        filtered_providers = controller._filter_providers(
            type=NotificationSettingEnum.DEPLOY.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
        )
        assert filtered_providers == [self.setting_providers[0]]

    def test_layering(self):
        NotificationSettingOption.objects.all().delete()
        top_level_option = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller._get_layered_setting_options()
        assert options[self.user][NotificationSettingEnum.WORKFLOW].value == top_level_option.value

        NotificationSettingProvider.objects.all().delete()
        top_level_provider = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )
        add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        providers = controller._get_layered_setting_providers()
        assert (
            providers[self.user][NotificationSettingEnum.WORKFLOW][
                ExternalProviderEnum.EMAIL.value
            ].value
            == top_level_provider.value
        )
        assert (
            providers[self.user][NotificationSettingEnum.DEPLOY][ExternalProviderEnum.EMAIL.value]
            == NotificationSettingsOptionEnum.COMMITTED_ONLY
        )
        assert (
            providers[self.user][NotificationSettingEnum.DEPLOY][ExternalProviderEnum.MSTEAMS.value]
            == NotificationSettingsOptionEnum.NEVER
        )

    def test_get_layered_setting_options(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller._get_layered_setting_options()

        assert (
            options[self.user][NotificationSettingEnum.DEPLOY].value
            == self.setting_options[0].value
        )
        assert (
            options[self.user][NotificationSettingEnum.ISSUE_ALERTS].value
            == self.setting_options[1].value
        )

        options = controller._get_layered_setting_options(
            type=NotificationSettingEnum.ISSUE_ALERTS.value
        )

        assert (
            options[self.user][NotificationSettingEnum.ISSUE_ALERTS].value
            == self.setting_options[1].value
        )

    def test_get_layered_setting_options_defaults(self):
        new_user = self.create_user()
        setting_option_1 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=new_user.id,
        )

        controller = NotificationController(
            recipients=[new_user, self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller._get_layered_setting_options()
        assert (
            options[new_user][NotificationSettingEnum.ISSUE_ALERTS].value == setting_option_1.value
        )

        user_options = options[self.user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS].value
            == self.setting_options[1].value
        )
        assert user_options[NotificationSettingEnum.DEPLOY].value == self.setting_options[0].value
        assert (
            user_options[NotificationSettingEnum.WORKFLOW]
            == NotificationSettingsOptionEnum.SUBSCRIBE_ONLY
        )

    def test_get_layered_setting_providers_defaults(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller._get_layered_setting_providers()
        user_options = options[self.user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS.value
            ].value
            == self.setting_providers[1].value
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK.value].value
            == self.setting_providers[0].value
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL.value].value
            == self.setting_providers[2].value
        )

    def test_get_setting_providers_with_defaults(self):
        new_user = self.create_user()
        setting_provider_1 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.MSTEAMS,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=new_user.id,
        )
        controller = NotificationController(
            recipients=[self.user, new_user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller._get_layered_setting_providers()
        assert (
            options[new_user][NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS.value
            ].value
            == setting_provider_1.value
        )

        user_options = options[self.user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS.value
            ].value
            == self.setting_providers[1].value
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK.value].value
            == self.setting_providers[0].value
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL.value].value
            == self.setting_providers[2].value
        )

    def test_get_combined_settings(self):
        new_user = self.create_user()
        self.create_member(
            organization=self.organization, user=new_user, role="member", teams=[self.team]
        )

        _ = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=new_user.id,
        )
        _ = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=new_user.id,
            provider=ExternalProviderEnum.MSTEAMS,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=new_user.id,
        )
        controller = NotificationController(
            recipients=[self.user, new_user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        enabled_settings = controller.get_combined_settings()

        # Settings for self.user
        for type, expected_setting in [
            (
                NotificationSettingEnum.DEPLOY,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
            (
                NotificationSettingEnum.WORKFLOW,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                },
            ),
            (
                NotificationSettingEnum.ISSUE_ALERTS,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
            (
                NotificationSettingEnum.REPORTS,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
            (
                NotificationSettingEnum.QUOTA,
                {
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
        ]:
            provider_settings = enabled_settings[self.user][type]
            assert provider_settings == expected_setting

        # Settings for new_user
        for type, expected_setting in [
            (
                NotificationSettingEnum.DEPLOY,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.COMMITTED_ONLY,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.COMMITTED_ONLY,
                },
            ),
            (
                NotificationSettingEnum.WORKFLOW,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                },
            ),
            (
                NotificationSettingEnum.ISSUE_ALERTS,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.MSTEAMS.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
            (
                NotificationSettingEnum.REPORTS,
                {
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
            (
                NotificationSettingEnum.QUOTA,
                {
                    ExternalProviderEnum.SLACK.value: NotificationSettingsOptionEnum.ALWAYS,
                    ExternalProviderEnum.EMAIL.value: NotificationSettingsOptionEnum.ALWAYS,
                },
            ),
        ]:
            provider_settings = enabled_settings[new_user][type]
            assert provider_settings == expected_setting

    def test_get_notification_recipients(self):
        rpc_user = Actor.from_object(self.user)
        new_user = self.create_user()
        rpc_new_user = Actor.from_object(new_user)
        self.create_member(
            organization=self.organization, user=new_user, role="member", teams=[self.team]
        )

        _ = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=new_user.id,
        )
        _ = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=new_user.id,
            provider=ExternalProviderEnum.MSTEAMS,
            type=NotificationSettingEnum.ISSUE_ALERTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=new_user.id,
        )
        controller = NotificationController(
            recipients=[self.user, new_user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        recipients = controller.get_notification_recipients(
            type=NotificationSettingEnum.ISSUE_ALERTS,
            actor_type=ActorType.USER,
        )
        assert recipients[ExternalProviders.SLACK] == {rpc_user, rpc_new_user}
        assert recipients[ExternalProviders.EMAIL] == {rpc_user, rpc_new_user}
        assert recipients[ExternalProviders.MSTEAMS] == {rpc_new_user}

    def test_user_has_any_provider_settings(self):
        controller = NotificationController(
            recipients=[self.user],
            organization_id=self.organization.id,
        )
        assert controller.user_has_any_provider_settings(provider=ExternalProviderEnum.SLACK)
        assert controller.user_has_any_provider_settings(provider=ExternalProviderEnum.EMAIL)
        assert not controller.user_has_any_provider_settings(provider=ExternalProviderEnum.MSTEAMS)

    def test_get_subscriptions_status_for_projects(self):
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert controller.get_subscriptions_status_for_projects(
            project_ids=[self.project.id],
            user=self.user,
            type=NotificationSettingEnum.DEPLOY,
        ) == {
            self.project.id: GroupSubscriptionStatus(
                is_disabled=False, is_active=True, has_only_inactive_subscriptions=False
            )
        }

        assert controller.get_subscriptions_status_for_projects(
            project_ids=[self.project.id],
            user=self.user,
            type=NotificationSettingEnum.WORKFLOW,
        ) == {
            self.project.id: GroupSubscriptionStatus(
                is_disabled=True, is_active=False, has_only_inactive_subscriptions=True
            )
        }

        assert controller.get_subscriptions_status_for_projects(
            project_ids=[self.project.id],
            user=self.user,
            type=NotificationSettingEnum.QUOTA,
        ) == {
            self.project.id: GroupSubscriptionStatus(
                is_disabled=False, is_active=True, has_only_inactive_subscriptions=False
            )
        }

    def test_get_participants(self):
        rpc_user = Actor.from_object(self.user)
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
        )

        assert controller.get_participants() == {
            rpc_user: {
                ExternalProviders.EMAIL: NotificationSettingsOptionEnum.ALWAYS,
                ExternalProviders.SLACK: NotificationSettingsOptionEnum.ALWAYS,
            }
        }

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.WORKFLOW,
        )

        assert controller.get_participants() == {
            rpc_user: {
                ExternalProviders.EMAIL: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                ExternalProviders.SLACK: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            }
        }

    @with_feature("organizations:team-workflow-notifications")
    def test_get_team_workflow_participants(self):
        rpc_user = Actor.from_object(self.team)
        with assume_test_silo_mode(SiloMode.REGION):
            link_team(self.team, self.integration, "#team-channel", "team_channel_id")
        controller = NotificationController(
            recipients=[self.team],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.WORKFLOW,
        )
        assert controller.get_participants() == {
            rpc_user: {
                ExternalProviders.SLACK: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                ExternalProviders.EMAIL: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            }
        }

    @with_feature("organizations:team-workflow-notifications")
    def test_get_team_issue_alert_participants(self):
        rpc_user = Actor.from_object(self.team)
        with assume_test_silo_mode(SiloMode.REGION):
            link_team(self.team, self.integration, "#team-channel", "team_channel_id")
        controller = NotificationController(
            recipients=[self.team],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS,
        )
        assert controller.get_participants() == {
            rpc_user: {
                ExternalProviders.SLACK: NotificationSettingsOptionEnum.ALWAYS,
                ExternalProviders.EMAIL: NotificationSettingsOptionEnum.ALWAYS,
            }
        }

    def test_get_notification_value_for_recipient_and_type(self):
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )

        add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.QUOTA_ERRORS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.DEPLOY,
            )
            == NotificationSettingsOptionEnum.ALWAYS
        )

        assert (
            controller.get_notification_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.WORKFLOW,
            )
            == NotificationSettingsOptionEnum.SUBSCRIBE_ONLY
        )

        assert (
            controller.get_notification_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.QUOTA_ERRORS,
            )
            == NotificationSettingsOptionEnum.NEVER
        )

    def test_get_notification_provider_value_for_recipient_and_type(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_provider_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.DEPLOY,
                provider=ExternalProviderEnum.SLACK,
            )
            == NotificationSettingsOptionEnum.ALWAYS
        )

    def test_get_notification_value_for_recipient_and_type_with_layering(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.DEPLOY,
            )
            == NotificationSettingsOptionEnum.ALWAYS
        )

        # overrides the user setting in setUp()
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.DEPLOY,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.DEPLOY,
            )
            == NotificationSettingsOptionEnum.NEVER
        )

    def test_get_notification_provider_value_for_recipient_and_type_with_layering(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_provider_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.WORKFLOW,
                provider=ExternalProviderEnum.EMAIL,
            )
            == NotificationSettingsOptionEnum.ALWAYS
        )

        # overrides the user setting in setUp()
        add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.WORKFLOW,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )

        assert (
            controller.get_notification_provider_value_for_recipient_and_type(
                recipient=self.user,
                type=NotificationSettingEnum.WORKFLOW,
                provider=ExternalProviderEnum.EMAIL,
            )
            == NotificationSettingsOptionEnum.NEVER
        )

    def test_get_users_for_weekly_reports(self):
        controller = NotificationController(
            recipients=[self.user],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.REPORTS,
        )
        assert controller.get_users_for_weekly_reports() == [self.user.id]

        add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            organization_id=self.organization.id,
            type=NotificationSettingEnum.REPORTS,
        )
        assert controller.get_users_for_weekly_reports() == []

    @with_feature("organizations:team-workflow-notifications")
    def test_fallback_if_invalid_team(self):
        # team with invalid provider
        team1 = self.create_team()
        user1 = self.create_user()
        self.create_member(user=user1, organization=self.organization, role="member", teams=[team1])
        with assume_test_silo_mode(SiloMode.REGION):
            ExternalActor.objects.create(
                team_id=team1.id,
                integration_id=self.integration.id,
                organization_id=self.organization.id,
                provider=0,
                external_name="invalid-integration",
            )

        # team with no providers
        team2 = self.create_team()
        user2 = self.create_user()
        self.create_member(user=user2, organization=self.organization, role="member", teams=[team2])

        controller = NotificationController(
            recipients=[team1, team2],
            organization_id=self.organization.id,
        )

        assert len(controller.recipients) == 2
        for recipient in controller.recipients:
            assert isinstance(recipient, Actor) and recipient.actor_type == ActorType.USER

    @with_feature("organizations:team-workflow-notifications")
    def test_keeps_team_as_recipient_if_valid(self):
        team = self.create_team()
        user1 = self.create_user()
        user2 = self.create_user()
        self.create_member(user=user1, organization=self.organization, role="member", teams=[team])
        self.create_member(user=user2, organization=self.organization, role="member", teams=[team])
        with assume_test_silo_mode(SiloMode.REGION):
            link_team(team, self.integration, "#team-channel", "team_channel_id")

        controller = NotificationController(
            recipients=[team],
            organization_id=self.organization.id,
        )

        assert len(controller.recipients) == 1
        assert isinstance(controller.recipients[0], Team)

    @with_feature("organizations:team-workflow-notifications")
    def test_user_recipients_remain(self):
        user1 = self.create_user()
        user2 = self.create_user()

        controller = NotificationController(
            recipients=[user1, user2],
            organization_id=self.organization.id,
        )

        assert len(controller.recipients) == 2
