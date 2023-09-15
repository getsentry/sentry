from django.db.models import Q

from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.notificationcontroller import NotificationController
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.testutils.cases import TestCase
from sentry.types.integrations import ExternalProviderEnum


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
# NotificationSettingOption and NotificationSettingProvider tables,
# which will be enabled with the "organization:notification-settings-v2" flag.
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
        assert list(controller.get_all_setting_options()) == self.setting_options

    def test_get_all_setting_providers(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        assert list(controller.get_all_setting_providers()) == self.setting_providers

    def test_layering(self):
        NotificationSettingOption.objects.all().delete()
        top_level_option = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.NEVER,
            user_id=self.user.id,
        )
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller.get_layered_setting_options()
        scope = (NotificationScopeEnum.PROJECT, top_level_option.scope_identifier)
        assert options[self.user][scope][NotificationSettingEnum.REPORTS] == top_level_option.value

        NotificationSettingProvider.objects.all().delete()
        top_level_provider = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.PROJECT,
            scope_identifier=self.project.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )
        add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.ALWAYS,
            user_id=self.user.id,
        )
        add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.EMAIL,
            type=NotificationSettingEnum.REPORTS,
            value=NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
            user_id=self.user.id,
        )

        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        providers = controller.get_layered_setting_providers()
        scope = (NotificationScopeEnum.PROJECT, top_level_provider.scope_identifier)
        assert (
            providers[self.user][scope][NotificationSettingEnum.REPORTS][ExternalProviderEnum.EMAIL]
            == top_level_provider.value
        )
        assert (
            providers[self.user][scope][NotificationSettingEnum.DEPLOY][ExternalProviderEnum.EMAIL]
            == NotificationSettingsOptionEnum.ALWAYS
        )
        assert (
            providers[self.user][scope][NotificationSettingEnum.DEPLOY][
                ExternalProviderEnum.MSTEAMS
            ]
            == NotificationSettingsOptionEnum.NEVER
        )

    def test_get_layered_setting_options(self):
        controller = NotificationController(
            recipients=[self.user],
            project_ids=[self.project.id],
            organization_id=self.organization.id,
        )
        options = controller.get_layered_setting_options()

        scope = (NotificationScopeEnum.PROJECT, self.project.id)
        assert (
            options[self.user][scope][NotificationSettingEnum.DEPLOY]
            == self.setting_options[0].value
        )
        assert (
            options[self.user][scope][NotificationSettingEnum.ISSUE_ALERTS]
            == self.setting_options[1].value
        )

        options = controller.get_layered_setting_options(
            additional_filters=Q(type=NotificationSettingEnum.ISSUE_ALERTS.value)
        )

        assert (
            options[self.user][scope][NotificationSettingEnum.ISSUE_ALERTS]
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
        options = controller.get_layered_setting_options()
        scope = (NotificationScopeEnum.PROJECT, self.project.id)
        assert (
            options[new_user][scope][NotificationSettingEnum.ISSUE_ALERTS] == setting_option_1.value
        )

        user_options = options[self.user][scope]
        assert user_options[NotificationSettingEnum.ISSUE_ALERTS] == self.setting_options[1].value
        assert user_options[NotificationSettingEnum.DEPLOY] == self.setting_options[0].value
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
        options = controller.get_layered_setting_providers()
        scope = (NotificationScopeEnum.PROJECT, self.project.id)
        user_options = options[self.user][scope]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][ExternalProviderEnum.MSTEAMS]
            == self.setting_providers[1].value
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK]
            == self.setting_providers[0].value
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL]
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
        scope = (NotificationScopeEnum.PROJECT, self.project.id)
        options = controller.get_layered_setting_providers()
        assert (
            options[new_user][scope][NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS
            ]
            == setting_provider_1.value
        )

        user_options = options[self.user][scope]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][ExternalProviderEnum.MSTEAMS]
            == self.setting_providers[1].value
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK]
            == self.setting_providers[0].value
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL]
            == self.setting_providers[2].value
        )

    def test_get_notification_recipients(self):
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
        recipients = controller.get_notification_recipients(
            type=NotificationSettingEnum.ISSUE_ALERTS
        )
        assert recipients[ExternalProviderEnum.SLACK] == {self.user, new_user}
        assert recipients[ExternalProviderEnum.EMAIL] == {self.user, new_user}
        assert recipients[ExternalProviderEnum.MSTEAMS] == {new_user}

    def test_user_has_any_provider_settings(self):
        controller = NotificationController(
            recipients=[self.user],
            organization_id=self.organization.id,
        )
        assert controller.user_has_any_provider_settings(provider=ExternalProviderEnum.SLACK)
        assert controller.user_has_any_provider_settings(provider=ExternalProviderEnum.EMAIL)
        assert not controller.user_has_any_provider_settings(provider=ExternalProviderEnum.MSTEAMS)
