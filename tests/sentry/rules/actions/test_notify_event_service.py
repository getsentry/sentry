from __future__ import absolute_import

from sentry.utils.compat.mock import MagicMock, patch

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

        rule = self.get_rule(data={"service": "mail"})

        with patch("sentry.plugins.base.plugins.get") as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) == 1
        assert plugin.should_notify.call_count == 1
        assert results[0].callback is plugin.rule_notify

    def test_applies_correctly_for_sentry_apps(self):
        event = self.get_event()

        self.create_sentry_app(
            organization=event.organization, name="Test Application", is_alertable=True
        )

        rule = self.get_rule(data={"service": "test-application"})

        results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) == 1
        assert results[0].callback is notify_sentry_app

    def test_notify_sentry_app_and_plugin_with_same_slug(self):
        event = self.get_event()

        self.create_sentry_app(organization=event.organization, name="Notify", is_alertable=True)

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        rule = self.get_rule(data={"service": "notify"})

        with patch("sentry.plugins.base.plugins.get") as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event, state=self.get_state()))

        assert len(results) == 2
        assert plugin.should_notify.call_count == 1
        assert results[0].callback is notify_sentry_app
        assert results[1].callback is plugin.rule_notify
