import types
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pytest
from django.db.models import Q

from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.rule import Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_all_setting_options,
    get_all_setting_providers,
    get_layered_setting_options,
    get_layered_setting_providers,
    get_notification_recipients,
    get_scope_type,
    get_setting_options_with_defaults,
    get_setting_providers_with_defaults,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_values_by_provider_by_type,
    is_double_write_enabled,
    user_has_any_provider_settings,
    validate,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    NotificationScopeEnum,
    NotificationScopeType,
    NotificationSettingEnum,
    NotificationSettingOptionValues,
    NotificationSettingsOptionEnum,
    NotificationSettingTypes,
)
from sentry.notifications.utils import (
    get_email_link_extra_params,
    get_group_settings_link,
    get_rules,
)
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.testutils.cases import TestCase
from sentry.types.integrations import ExternalProviderEnum, ExternalProviders


def mock_event(*, transaction, data=None):
    return types.SimpleNamespace(data=data or {}, transaction=transaction)


def add_notification_setting_option(
    scope_type,
    scope_identifier,
    type,
    value,
    user_id=None,
    team_id=None,
):
    return NotificationSettingOption.objects.create(
        scope_type=scope_type,
        scope_identifier=scope_identifier,
        type=type,
        value=value,
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
        scope_type=scope_type,
        scope_identifier=scope_identifier,
        provider=provider,
        type=type,
        value=value,
        user_id=user_id,
        team_id=team_id,
    )


class DoubleWriteTests(TestCase):
    @mock.patch("sentry.notifications.helpers.features.has", return_value=False)
    def test_is_double_write_enabled_user(self, mock_has):
        # Create dummy users and organizations
        user1 = self.create_user()
        user2 = self.create_user()
        org1 = self.create_organization()
        org2 = self.create_organization()
        org3 = self.create_organization()

        # Add users to organizations
        self.create_member(user=user1, organization=org1)
        self.create_member(user=user2, organization=org2)
        self.create_member(user=user1, organization=org3)

        is_double_write_enabled(user_id=user1.id)

        mapped_org1 = OrganizationMapping.objects.get(organization_id=org1.id)
        mapped_org2 = OrganizationMapping.objects.get(organization_id=org2.id)
        mapped_org3 = OrganizationMapping.objects.get(organization_id=org3.id)
        # Ensure mock_has is called on the right organizations
        mock_has.assert_any_call(
            "organizations:notifications-double-write", serialize_organization_mapping(mapped_org1)
        )
        mock_has.assert_any_call(
            "organizations:notifications-double-write", serialize_organization_mapping(mapped_org3)
        )
        for call in mock_has.call_args_list:
            self.assertNotEqual(
                call[0],
                (
                    "organizations:notifications-double-write",
                    serialize_organization_mapping(mapped_org2),
                ),
            )

    @mock.patch("sentry.notifications.helpers.features.has", return_value=False)
    def test_is_double_write_enabled_team(self, mock_has):
        # Create dummy users and organizations
        org1 = self.create_organization()
        org2 = self.create_organization()

        team1 = self.create_team(organization=org1)
        self.create_team(organization=org2)

        is_double_write_enabled(organization_id_for_team=team1.organization_id)

        mapped_org1 = OrganizationMapping.objects.get(organization_id=org1.id)
        mapped_org2 = OrganizationMapping.objects.get(organization_id=org2.id)

        # Ensure mock_has is called on the right organizations
        mock_has.assert_any_call(
            "organizations:notifications-double-write", serialize_organization_mapping(mapped_org1)
        )
        for call in mock_has.call_args_list:
            self.assertNotEqual(
                call[0],
                (
                    "organizations:notifications-double-write",
                    serialize_organization_mapping(mapped_org2),
                ),
            )

    def test_test_is_double_write_invalid_input(self):
        with pytest.raises(ValueError):
            is_double_write_enabled()


class NotificationHelpersTest(TestCase):
    def setUp(self):
        super().setUp()

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )

    def test_get_deploy_values_by_provider_empty_settings(self):
        values_by_provider = get_values_by_provider_by_type(
            {},
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
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
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
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

    def test_get_subscription_from_attributes(self):
        attrs = {"subscription": (True, True, None)}
        assert get_subscription_from_attributes(attrs) == (True, {"disabled": True})

        attrs = {"subscription": (True, False, None)}
        assert get_subscription_from_attributes(attrs) == (False, {"disabled": True})

    def test_collect_groups_by_project(self):
        assert collect_groups_by_project([self.group]) == {self.project.id: {self.group}}

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

    def test_get_group_settings_link(self):
        rule: Rule = self.create_project_rule(self.project)
        rule_details = get_rules([rule], self.organization, self.project)
        link = get_group_settings_link(
            self.group, self.environment.name, rule_details, 1337, extra="123"
        )

        parsed = urlparse(link)
        query_dict = dict(map(lambda x: (x[0], x[1][0]), parse_qs(parsed.query).items()))
        assert f"{parsed.scheme}://{parsed.hostname}{parsed.path}" == self.group.get_absolute_url()
        assert query_dict == {
            "referrer": "alert_email",
            "environment": self.environment.name,
            "alert_type": "email",
            "alert_timestamp": str(1337),
            "alert_rule_id": str(rule_details[0].id),
            "extra": "123",
        }

    def test_get_email_link_extra_params(self):
        rule: Rule = self.create_project_rule(self.project)
        project2 = self.create_project()
        rule2 = self.create_project_rule(project2)

        rule_details = get_rules([rule, rule2], self.organization, self.project)
        extra_params = {
            k: dict(map(lambda x: (x[0], x[1][0]), parse_qs(v.strip("?")).items()))
            for k, v in get_email_link_extra_params(
                "digest_email", None, rule_details, 1337
            ).items()
        }

        assert extra_params == {
            rule_detail.id: {
                "referrer": "digest_email",
                "alert_type": "email",
                "alert_timestamp": str(1337),
                "alert_rule_id": str(rule_detail.id),
            }
            for rule_detail in rule_details
        }


# The tests below are intended to check behavior with the new
# NotificationSettingOption and NotificationSettingProvider tables,
# which will be enabled with the "organization:notification-settings-v2" flag.
class NotificationSettingV2HelpersTest(TestCase):
    def setUp(self):
        super().setUp()
        setting_option_1 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            type=NotificationSettingEnum.DEPLOY.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=self.user.id,
        )
        setting_option_2 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=self.user.id,
        )
        setting_option_3 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.NEVER.value,
            user_id=self.user.id,
        )

        self.setting_options = [setting_option_1, setting_option_2, setting_option_3]

        setting_provider_1 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.SLACK.value,
            type=NotificationSettingEnum.DEPLOY.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=self.user.id,
        )
        setting_provider_2 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.project.id,
            provider=ExternalProviderEnum.MSTEAMS.value,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.NEVER.value,
            user_id=self.user.id,
        )
        setting_provider_3 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=self.user.id,
            provider=ExternalProviderEnum.EMAIL.value,
            type=NotificationSettingEnum.WORKFLOW.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=self.user.id,
        )

        self.setting_providers = [setting_provider_1, setting_provider_2, setting_provider_3]
        self.rpc_user = RpcUser(id=self.user.id)

    def test_get_all_setting_options(self):
        options = list(get_all_setting_options([self.user], [self.project], self.organization))
        assert options == self.setting_options

    def test_get_all_setting_providers(self):
        assert (
            list(get_all_setting_providers([self.user], [self.project], self.organization))
            == self.setting_providers
        )

    def test_get_layered_setting_options(self):
        options = get_layered_setting_options([self.user], [self.project], self.organization)

        assert options[self.rpc_user][NotificationSettingEnum.DEPLOY] == self.setting_options[0]
        assert (
            options[self.rpc_user][NotificationSettingEnum.ISSUE_ALERTS] == self.setting_options[1]
        )

        options = get_layered_setting_options(
            [self.user],
            [self.project],
            self.organization,
            additional_filters=Q(type=NotificationSettingEnum.ISSUE_ALERTS.value),
        )

        assert (
            options[self.rpc_user][NotificationSettingEnum.ISSUE_ALERTS] == self.setting_options[1]
        )

    def test_get_setting_options_with_defaults(self):
        new_user = self.create_user()
        setting_option_1 = add_notification_setting_option(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.NEVER.value,
            user_id=new_user.id,
        )
        rpc_new_user = RpcUser(id=new_user.id)

        options = get_setting_options_with_defaults(
            [self.user, new_user], [self.project], self.organization
        )
        assert (
            options[rpc_new_user][NotificationSettingEnum.ISSUE_ALERTS].value
            == setting_option_1.value
        )

        user_options = options[self.rpc_user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS].value
            == self.setting_options[1].value
        )
        assert user_options[NotificationSettingEnum.DEPLOY].value == self.setting_options[0].value
        assert (
            user_options[NotificationSettingEnum.WORKFLOW].value
            == NotificationSettingsOptionEnum.SUBSCRIBE_ONLY.value
        )

    def test_get_layered_setting_providers(self):
        new_user = self.create_user()
        setting_provider_1 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.MSTEAMS.value,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.NEVER.value,
            user_id=new_user.id,
        )
        rpc_new_user = RpcUser(id=new_user.id)

        options = get_layered_setting_providers(
            [self.user, new_user], [self.project], self.organization
        )
        assert (
            options[rpc_new_user][NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS
            ]
            == setting_provider_1
        )
        user_options = options[self.rpc_user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][ExternalProviderEnum.MSTEAMS]
            == self.setting_providers[1]
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK]
            == self.setting_providers[0]
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL]
            == self.setting_providers[2]
        )

    def test_get_setting_providers_with_defaults(self):
        new_user = self.create_user()
        setting_provider_1 = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=self.organization.id,
            provider=ExternalProviderEnum.MSTEAMS.value,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.NEVER.value,
            user_id=new_user.id,
        )
        rpc_new_user = RpcUser(id=new_user.id)

        options = get_setting_providers_with_defaults(
            [self.user, new_user], [self.project], self.organization
        )
        assert (
            options[rpc_new_user][NotificationSettingEnum.ISSUE_ALERTS][
                ExternalProviderEnum.MSTEAMS
            ].value
            == setting_provider_1.value
        )

        user_options = options[self.rpc_user]
        assert (
            user_options[NotificationSettingEnum.ISSUE_ALERTS][ExternalProviderEnum.MSTEAMS].value
            == self.setting_providers[1].value
        )
        assert (
            user_options[NotificationSettingEnum.DEPLOY][ExternalProviderEnum.SLACK].value
            == self.setting_providers[0].value
        )
        assert (
            user_options[NotificationSettingEnum.WORKFLOW][ExternalProviderEnum.EMAIL].value
            == self.setting_providers[2].value
        )

    def test_get_notification_recipients(self):
        new_user = self.create_user()
        rpc_new_user = RpcUser(id=new_user.id)
        self.create_member(
            organization=self.organization, user=new_user, role="member", teams=[self.team]
        )

        _ = add_notification_setting_option(
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier=self.project.id,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=new_user.id,
        )
        _ = add_notification_setting_provider(
            scope_type=NotificationScopeEnum.USER.value,
            scope_identifier=new_user.id,
            provider=ExternalProviderEnum.MSTEAMS.value,
            type=NotificationSettingEnum.ISSUE_ALERTS.value,
            value=NotificationSettingsOptionEnum.ALWAYS.value,
            user_id=new_user.id,
        )

        recipients = get_notification_recipients(self.project)
        assert recipients[ExternalProviderEnum.SLACK] == {self.rpc_user, rpc_new_user}
        assert recipients[ExternalProviderEnum.EMAIL] == {self.rpc_user, rpc_new_user}
        assert recipients[ExternalProviderEnum.MSTEAMS] == {rpc_new_user}

    def test_user_has_any_provider_settings(self):
        assert user_has_any_provider_settings(self.user, provider=ExternalProviderEnum.SLACK)
        assert user_has_any_provider_settings(self.user, provider=ExternalProviderEnum.EMAIL)
        assert not user_has_any_provider_settings(self.user, provider=ExternalProviderEnum.MSTEAMS)
