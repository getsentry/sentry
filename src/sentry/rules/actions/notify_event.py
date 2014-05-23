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
    label = 'Send a notification'

    def after(self, event, **kwargs):
        for plugin in plugins.for_project(event.project):
            if hasattr(plugin, 'notify_users'):
                safe_execute(plugin.notify_users, group=event.group, event=event)
