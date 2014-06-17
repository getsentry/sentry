"""
sentry.rules.actions.notify_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.plugins import plugins
from sentry.rules.actions.base import EventAction
from sentry.utils.safe import safe_execute


class NotifyEventAction(EventAction):
    label = 'Send a notification (for all enabled services)'

    def get_plugins(self):
        from sentry.plugins.bases.notify import NotificationPlugin

        results = []
        for plugin in plugins.for_project(self.project):
            if not isinstance(plugin, NotificationPlugin):
                continue
            results.append(plugin)
        return results

    def after(self, event, state):
        group = event.group

        for plugin in self.get_plugins():
            if not safe_execute(plugin.should_notify, group=group, event=event):
                continue

            safe_execute(plugin.notify_users, group=group, event=event)
