from __future__ import absolute_import

from mock import MagicMock

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event import NotifyEventAction


class NotifyEventActionTest(RuleTestCase):
    rule_cls = NotifyEventAction

    def test_applies_correctly(self):
        event = self.get_event()

        plugin = MagicMock()
        rule = self.get_rule()
        rule.get_plugins = lambda: (plugin,)

        results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) is 1
        assert plugin.should_notify.call_count is 1
        assert results[0].callback is plugin.rule_notify
