from unittest.mock import MagicMock

from sentry.models.options.project_option import ProjectOption
from sentry.plugins.base import plugins
from sentry.rules.actions.notify_event import NotifyEventAction
from sentry.rules.actions.services import LegacyPluginService
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.features import with_feature
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

    def test_get_plugins_includes_webhooks_by_default(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com/hook")
        webhook_plugin = plugins.get("webhooks")
        webhook_plugin.set_option("enabled", True, self.project)

        rule = self.get_rule()
        result_slugs = [p.service.slug for p in rule.get_plugins()]

        assert "webhooks" in result_slugs

    @with_feature("organizations:legacy-webhook-disable-old-path")
    def test_get_plugins_skips_webhooks_when_old_path_disabled(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com/hook")
        webhook_plugin = plugins.get("webhooks")
        webhook_plugin.set_option("enabled", True, self.project)

        rule = self.get_rule()
        result_slugs = [p.service.slug for p in rule.get_plugins()]

        assert "webhooks" not in result_slugs
