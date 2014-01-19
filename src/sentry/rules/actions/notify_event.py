"""
sentry.rules.actions.notify_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.rules.actions.base import EventAction


class NotifyEventAction(EventAction):
    label = 'Send a notification'

    def notify(self, event):
        # TODO: fire off plugin notifications
        pass

    def after(self, event, **kwargs):
        if self.should_notify(event):
            self.notify(event)

    def passes(self, event, **kwargs):
        raise NotImplementedError
