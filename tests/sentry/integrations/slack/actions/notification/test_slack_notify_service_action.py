from uuid import uuid4

from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestCase


class TestInit(TestCase):
    def setUp(self) -> None:
        self.rule = self.create_project_rule(project=self.project)
        self.notification_uuid = str(uuid4())
        self.event_id = 456
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=self.notification_uuid,
        )

    def test_when_rule_fire_history_is_passed_in(self) -> None:
        instance = SlackNotifyServiceAction(
            self.project, data={}, rule=self.rule, rule_fire_history=self.rule_fire_history
        )
        assert instance._rule_fire_history is not None

    def test_when_rule_fire_history_is_not_passed_in(self) -> None:
        instance = SlackNotifyServiceAction(self.project, data={}, rule=self.rule)
        assert instance._rule_fire_history is None

    def test_when_rule_fire_history_is_none(self) -> None:
        instance = SlackNotifyServiceAction(
            self.project, data={}, rule=self.rule, rule_fire_history=None
        )
        assert instance._rule_fire_history is None
