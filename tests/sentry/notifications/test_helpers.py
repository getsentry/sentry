from urllib.parse import parse_qs, urlparse

from sentry.models.rule import Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_subscription_from_attributes,
    validate,
)
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import NotificationSettingEnum, NotificationSettingsOptionEnum
from sentry.notifications.utils.links import (
    get_email_link_extra_params,
    get_group_settings_link,
    get_rules,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class NotificationHelpersTest(TestCase):
    def setUp(self) -> None:
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

    def test_validate(self) -> None:
        self.assertTrue(
            validate(NotificationSettingEnum.ISSUE_ALERTS, NotificationSettingsOptionEnum.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingEnum.ISSUE_ALERTS, NotificationSettingsOptionEnum.NEVER)
        )

        self.assertTrue(
            validate(NotificationSettingEnum.DEPLOY, NotificationSettingsOptionEnum.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingEnum.DEPLOY, NotificationSettingsOptionEnum.NEVER)
        )
        self.assertTrue(
            validate(NotificationSettingEnum.DEPLOY, NotificationSettingsOptionEnum.COMMITTED_ONLY)
        )
        self.assertFalse(
            validate(NotificationSettingEnum.DEPLOY, NotificationSettingsOptionEnum.SUBSCRIBE_ONLY)
        )

        self.assertTrue(
            validate(NotificationSettingEnum.WORKFLOW, NotificationSettingsOptionEnum.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingEnum.WORKFLOW, NotificationSettingsOptionEnum.NEVER)
        )
        self.assertTrue(
            validate(
                NotificationSettingEnum.WORKFLOW, NotificationSettingsOptionEnum.SUBSCRIBE_ONLY
            )
        )
        self.assertFalse(
            validate(
                NotificationSettingEnum.WORKFLOW, NotificationSettingsOptionEnum.COMMITTED_ONLY
            )
        )

    def test_get_subscription_from_attributes(self) -> None:
        attrs = {"subscription": (True, True, None)}
        assert get_subscription_from_attributes(attrs) == (True, {"disabled": True})

        attrs = {"subscription": (True, False, None)}
        assert get_subscription_from_attributes(attrs) == (False, {"disabled": True})

    def test_collect_groups_by_project(self) -> None:
        assert collect_groups_by_project([self.group]) == {self.project.id: {self.group}}

    def test_get_group_settings_link(self) -> None:
        rule: Rule = self.create_project_rule(self.project)
        rule_details = get_rules([rule], self.organization, self.project, self.group.type)
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

    def test_get_email_link_extra_params(self) -> None:
        rule: Rule = self.create_project_rule(self.project)
        project2 = self.create_project()
        rule2 = self.create_project_rule(project2)

        rule_details = get_rules([rule, rule2], self.organization, self.project, self.group.type)
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
