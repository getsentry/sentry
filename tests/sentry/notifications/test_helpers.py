from urllib.parse import parse_qs, urlparse

from sentry.models.rule import Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_subscription_from_attributes,
    validate,
)
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import (
    TEST_NOTIFICATION_ID,
    NotificationOrigin,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
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
        origin = NotificationOrigin.from_legacy_rule(rule)
        rule_details = get_rules([origin], self.organization, self.project, self.group.type)
        assert rule_details[0].id == rule.id
        assert rule_details[0].status_url == (
            f"/organizations/{self.organization.slug}/issues/alerts/rules/"
            f"{self.project.slug}/{rule.id}/details/"
        )
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

    def test_get_rules_uses_workflow_identity_without_legacy_rule(self) -> None:
        rule = self.create_project_rule(self.project, include_legacy_rule_id=False)
        origin = NotificationOrigin.from_legacy_rule(rule)

        [rule_details] = get_rules([origin], self.organization, self.project)

        workflow_id = int(rule.data["actions"][0]["workflow_id"])
        assert rule_details.id == workflow_id
        assert rule_details.status_url == (
            f"/organizations/{self.organization.slug}/monitors/alerts/{workflow_id}/"
        )

    def test_get_rules_falls_back_to_rule_id_without_embedded_identity(self) -> None:
        rule = self.create_project_rule(
            self.project, include_legacy_rule_id=False, include_workflow_id=False
        )
        origin = NotificationOrigin.from_legacy_rule(rule)

        [rule_details] = get_rules([origin], self.organization, self.project)

        assert rule_details.id == rule.id
        assert rule_details.status_url == (
            f"/organizations/{self.organization.slug}/issues/alerts/rules/"
            f"{self.project.slug}/{rule.id}/details/"
        )

    def test_notification_origin_normalizes_legacy_identity(self) -> None:
        rule = self.create_project_rule(self.project)
        rule.data["actions"][0]["legacy_rule_id"] = str(rule.id)
        workflow_id = rule.data["actions"][0]["workflow_id"]
        rule.data["actions"][0]["workflow_id"] = str(workflow_id)

        origin = NotificationOrigin.from_legacy_rule(rule)

        assert origin.label == rule.label
        assert origin.legacy_rule_id == rule.id
        assert origin.workflow_id == workflow_id
        assert not origin.is_test_notification()

    def test_notification_origin_identifies_test_notification(self) -> None:
        origin = NotificationOrigin.from_legacy_data(
            label="Test notification",
            environment_id=None,
            data={},
            fallback_legacy_rule_id=TEST_NOTIFICATION_ID,
        )

        assert origin.is_test_notification()

    def test_get_email_link_extra_params(self) -> None:
        rule: Rule = self.create_project_rule(self.project)
        project2 = self.create_project()
        rule2 = self.create_project_rule(project2)
        origins = [
            NotificationOrigin.from_legacy_rule(rule),
            NotificationOrigin.from_legacy_rule(rule2),
        ]

        rule_details = get_rules(origins, self.organization, self.project, self.group.type)
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
