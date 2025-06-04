from sentry.rules.actions import EventAction
from sentry.testutils.cases import TestCase


class TestRuleType(TestCase):
    def test_default(self) -> None:
        assert EventAction.rule_type == "action/event"
