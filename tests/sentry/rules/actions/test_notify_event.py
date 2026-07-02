from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class NotifyEventActionTest(RuleTestCase):
    rule_cls = NotifyEventAction

    def test_noop(self) -> None:
        event = self.get_event()
        rule = self.get_rule()
        results = list(rule.after(event=event))
        assert len(results) == 0
