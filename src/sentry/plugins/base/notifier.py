"""
sentry.plugins.base.notifier
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ('Notifier',)

from sentry.app import ratelimiter


class Notifier(object):
    def notify(self, notification, **kwargs):
        """
        Send a notification.

        See :class:`sentry.plugins.Notification` for notification properties.

        >>> def notify(self, notification):
        >>>     self.logger.info('Received notification for event %r', notification.event)
        """

    def should_notify(self, group, event):
        if group.is_ignored():
            return False

        project = group.project

        rate_limited = ratelimiter.is_limited(
            project=project,
            key=self.get_conf_key(),
            limit=10,
        )

        if rate_limited:
            self.logger.info('notification.rate_limited', extra={'project_id': project.id})

        return not rate_limited

    def notify_about_activity(self, activity):
        pass
