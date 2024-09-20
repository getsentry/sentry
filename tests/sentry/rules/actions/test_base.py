from uuid import uuid4

from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.actions.base import instantiate_action
from sentry.testutils.cases import TestCase


class TestInstantiateAction(TestCase):
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

    def test_passes_in_rule_fire_history(self) -> None:
        action = {
            "id": SlackNotifyServiceAction.id,
        }

        instance = instantiate_action(
            rule=self.rule, action=action, rule_fire_history=self.rule_fire_history
        )
        assert instance.rule_fire_history is not None
        assert instance.rule_fire_history == self.rule_fire_history

    def test_respects_empty_rule_fire_history(self) -> None:
        action = {
            "id": SlackNotifyServiceAction.id,
        }

        instance = instantiate_action(rule=self.rule, action=action)
        assert instance.rule_fire_history is None
