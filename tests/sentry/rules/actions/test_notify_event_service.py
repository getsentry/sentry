from __future__ import absolute_import

from mock import MagicMock, patch

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction


class NotifyEventServiceActionTest(RuleTestCase):
    rule_cls = NotifyEventServiceAction

    def test_applies_correctly(self):
        event = self.get_event()

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        rule = self.get_rule({
            'service': 'mail',
        })

        with patch('sentry.plugins.plugins.get') as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) is 1
        assert plugin.should_notify.call_count is 1
        assert results[0].callback is plugin.rule_notify
