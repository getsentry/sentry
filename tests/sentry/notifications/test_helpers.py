import types
from urllib.parse import parse_qs, urlparse

from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.rule import Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_team_members,
    get_values_by_provider_by_type,
    team_is_valid_recipient,
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
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.integrations import ExternalProviders


def mock_event(*, transaction, data=None):
    return types.SimpleNamespace(data=data or {}, transaction=transaction)


class NotificationHelpersTest(TestCase):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="workflow",
                value="always",
            )
            NotificationSettingOption.objects.create(
                user_id=self.user.id,
                scope_type="user",
                scope_identifier=self.user.id,
                type="deploy",
                value="always",
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

    def test_get_team_members(self):
        user1 = self.create_user()
        user2 = self.create_user()
        team1 = self.create_team()
        team2 = self.create_team()
        team3 = self.create_team()
        self.create_member(organization=self.organization, teams=[team1], user=user1)
        self.create_member(organization=self.organization, teams=[team2], user=user2)

        assert get_team_members(team1) == [RpcActor.from_object(user1)]
        assert get_team_members(team2) == [RpcActor.from_object(user2)]
        assert get_team_members(team3) == []

    def test_team_is_valid_recipient(self):
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)
        team3 = self.create_team(organization=self.organization)
        integration1 = self.create_integration(
            organization=self.organization, provider="Slack", external_id="slack-id"
        )
        integration2 = self.create_integration(
            organization=self.organization, provider="Jira", external_id="jira-id"
        )
        ExternalActor.objects.create(
            team_id=team1.id,
            organization=self.organization,
            integration_id=integration1.id,
            external_name="valid_integration",
            provider=110,
        )
        ExternalActor.objects.create(
            team_id=team2.id,
            organization=self.organization,
            integration_id=integration2.id,
            external_name="invalid_integration",
            provider=0,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            assert team_is_valid_recipient(team1)
            assert not team_is_valid_recipient(team2)
            assert not team_is_valid_recipient(team3)
