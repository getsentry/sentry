from __future__ import absolute_import

from mock import MagicMock, patch

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction
from sentry.tasks.sentry_apps import notify_sentry_app


class NotifyEventServiceActionTest(RuleTestCase):
    rule_cls = NotifyEventServiceAction

    def test_applies_correctly_for_plugins(self):
        event = self.get_event()

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        rule = self.get_rule(data={
            'service': 'mail',
        })

        with patch('sentry.plugins.plugins.get') as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) is 1
        assert plugin.should_notify.call_count is 1
        assert results[0].callback is plugin.rule_notify

    def test_applies_correctly_for_sentry_apps(self):
        event = self.get_event()

        self.create_sentry_app(
            organization=event.organization,
            name='Test Application',
            is_alertable=True,
        )

        rule = self.get_rule(data={
            'service': 'test-application',
        })

        results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) is 1
        assert results[0].callback is notify_sentry_app
