"""
sentry.rules.actions.notify_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.plugins import plugins
from sentry.rules.actions.base import EventAction
from sentry.utils import metrics
from sentry.utils.safe import safe_execute


class NotifyEventAction(EventAction):
    label = 'Send a notification (for all enabled services)'

    def get_plugins(self):
        from sentry.plugins.bases.notify import NotificationPlugin

        results = []
        for plugin in plugins.for_project(self.project, version=1):
            if not isinstance(plugin, NotificationPlugin):
                continue
            results.append(plugin)

        for plugin in plugins.for_project(self.project, version=2):
            for notifier in (safe_execute(plugin.get_notifiers) or ()):
                results.append(notifier)

        return results

    def after(self, event, state):
        group = event.group

        for plugin in self.get_plugins():
            if not safe_execute(plugin.should_notify, group=group, event=event):
                continue

            metrics.incr('notifications.sent', instance=plugin.slug)
            yield self.future(plugin.rule_notify)
