import pytest

from sentry.notifications.types import TEST_NOTIFICATION_ID, NotificationActionContext
from sentry.rules.actions import EventAction
from sentry.rules.base import RuleBase
from sentry.testutils.cases import TestCase


class TestRuleType(TestCase):
    def test_default(self) -> None:
        assert EventAction.rule_type == "action/event"

    def test_legacy_rule_is_adapted_to_notification_context(self) -> None:
        rule = self.create_project_rule(project=self.project)

        instance = RuleBase(self.project, rule=rule)

        assert instance.context == NotificationActionContext.from_legacy_rule(rule)

    def test_context_and_legacy_rule_are_mutually_exclusive(self) -> None:
        rule = self.create_project_rule(project=self.project)
        context = NotificationActionContext.from_legacy_rule(rule)

        with pytest.raises(ValueError, match="context or legacy rule"):
            RuleBase(self.project, context=context, rule=rule)

    def test_legacy_test_rule_id_overrides_embedded_workflow(self) -> None:
        rule = self.create_project_rule(project=self.project)
        assert rule.data["actions"][0]["workflow_id"] is not None
        rule.id = TEST_NOTIFICATION_ID

        instance = RuleBase(self.project, rule=rule)

        assert instance.context is not None
        assert instance.context.origin.workflow_id is None
        assert instance.context.origin.legacy_rule_id == TEST_NOTIFICATION_ID
