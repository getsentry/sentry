from unittest.mock import patch
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
from sentry.testutils.helpers.notifications import (
    create_notification_origin,
    create_workflow_notification_origin_for_rule,
)
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

    def test_get_group_settings_link_uses_workflow(self) -> None:
        rule: Rule = self.create_project_rule(self.project)
        origin = create_workflow_notification_origin_for_rule(rule)
        rule_details = get_rules([origin], self.organization, self.project, self.group.type)
        assert origin.workflow_id is not None
        assert rule_details[0].id == origin.workflow_id
        assert rule_details[0].status_url == (
            f"/organizations/{self.organization.slug}/monitors/alerts/{origin.workflow_id}/"
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
        origin = NotificationOrigin(
            label="Test Alert",
            environment_id=None,
            workflow_id=123,
            legacy_rule_id=None,
        )

        [rule_details] = get_rules([origin], self.organization, self.project)

        workflow_id = origin.workflow_id
        assert workflow_id is not None
        assert rule_details.id == workflow_id
        assert rule_details.status_url == (
            f"/organizations/{self.organization.slug}/monitors/alerts/{workflow_id}/"
        )

    def test_get_rules_omits_origin_without_workflow_identity(self) -> None:
        rule = self.create_project_rule(self.project)
        origin = create_notification_origin(rule)

        assert get_rules([origin], self.organization, self.project) == []

    def test_notification_origin_identifies_test_notification(self) -> None:
        origin = NotificationOrigin(
            label="Test notification",
            environment_id=None,
            workflow_id=None,
            legacy_rule_id=TEST_NOTIFICATION_ID,
        )

        assert origin.is_test_notification()

    def test_notification_origin_logs_missing_identity(self) -> None:
        with patch("sentry.notifications.types.logger") as logger:
            NotificationOrigin(
                label="No identity", environment_id=None, workflow_id=None, legacy_rule_id=None
            )
            NotificationOrigin(
                label="Workflow", environment_id=None, workflow_id=1, legacy_rule_id=None
            )

        logger.warning.assert_called_once_with(
            "notifications.origin.missing_identity",
            extra={"label": "No identity", "environment_id": None},
            stack_info=True,
        )

    def test_get_email_link_extra_params(self) -> None:
        rule: Rule = self.create_project_rule(self.project)
        project2 = self.create_project()
        rule2 = self.create_project_rule(project2)
        origins = [
            create_workflow_notification_origin_for_rule(rule),
            create_workflow_notification_origin_for_rule(rule2),
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
