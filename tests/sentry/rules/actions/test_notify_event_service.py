from __future__ import absolute_import

from mock import MagicMock, patch

from sentry.testutils.cases import RuleTestCase
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction
from sentry.api.fields.actor import Actor
from sentry.models import User


class NotifyEventServiceActionTest(RuleTestCase):
    rule_cls = NotifyEventServiceAction

    def test_applies_correctly(self):
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

    def test_single_owner(self):
        event = self.get_event()

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        user = self.create_user()

        rule = self.get_rule(data={
            'service': 'mail',
        })

        with patch('sentry.plugins.plugins.get') as get_plugin:
            get_plugin.return_value = plugin

            results = list(
                rule.after(
                    event=event,
                    state=self.get_state(),
                    owners=Actor(user.id, User)
                )
            )

        assert len(results) is 1
        assert plugin.should_notify.call_count is 1
        assert results[0].callback is plugin.rule_notify

    def test_team_owner(self):
        pass

    def test_multiple_owners(self):
        pass
