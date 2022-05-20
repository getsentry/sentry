from typing import Generator, Sequence

from sentry.eventstore.models import Event
from sentry.plugins.base import plugins
from sentry.rules import EventState
from sentry.rules.actions.base import EventAction
from sentry.rules.actions.services import LegacyPluginService
from sentry.rules.base import CallbackFuture
from sentry.utils import metrics
from sentry.utils.safe import safe_execute


class NotifyEventAction(EventAction):
    """Used for notifying *all* enabled plugins."""

    id = "sentry.rules.actions.notify_event.NotifyEventAction"
    label = "Send a notification (for all legacy integrations)"
    prompt = "Send a notification to all legacy integrations"

    def get_plugins(self) -> Sequence[LegacyPluginService]:
        from sentry.plugins.bases.notify import NotificationPlugin

        results = []
        for plugin in plugins.for_project(self.project, version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue
            results.append(LegacyPluginService(plugin))

        for plugin in plugins.for_project(self.project, version=2):
            for notifier in safe_execute(plugin.get_notifiers, _with_transaction=False) or ():
                results.append(LegacyPluginService(notifier))

        return results

    def after(self, event: Event, state: EventState) -> Generator[CallbackFuture, None, None]:
        group = event.group

        for plugin_ in self.get_plugins():
            # plugin is now wrapped in the LegacyPluginService object
            plugin = plugin_.service
            if not safe_execute(
                plugin.should_notify, group=group, event=event, _with_transaction=False
            ):
                continue

            metrics.incr("notifications.sent", instance=plugin.slug, skip_internal=False)
            yield self.future(plugin.rule_notify)
