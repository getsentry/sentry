import types
from unittest import mock
from urllib.parse import parse_qs, urlparse

import pytest

from sentry.models.notificationsetting import NotificationSetting
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.rule import Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_values_by_provider_by_type,
    is_double_write_enabled,
    validate,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils import (
    get_email_link_extra_params,
    get_group_settings_link,
    get_rules,
)
from sentry.services.hybrid_cloud.organization_mapping.serial import serialize_organization_mapping
from sentry.testutils.cases import TestCase
from sentry.types.integrations import ExternalProviders


def mock_event(*, transaction, data=None):
    return types.SimpleNamespace(data=data or {}, transaction=transaction)


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

    @mock.patch("sentry.notifications.helpers.features.has", return_value=False)
    def test_no_orgs(self, mock_has):
        user1 = self.create_user()

        assert is_double_write_enabled(user_id=user1.id)
        mock_has.assert_not_called()


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
