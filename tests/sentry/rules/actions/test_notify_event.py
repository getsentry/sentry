from unittest.mock import MagicMock

from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.rules.actions.services import LegacyPluginService
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class NotifyEventActionTest(RuleTestCase):
    rule_cls = NotifyEventAction

    def test_applies_correctly(self) -> None:
        event = self.get_event()

        plugin = MagicMock()
        rule = self.get_rule()
        rule.get_plugins = lambda: (LegacyPluginService(plugin),)

        results = list(rule.after(event=event))

        assert len(results) == 1
        assert plugin.should_notify.call_count == 1
        assert results[0].callback is plugin.rule_notify
