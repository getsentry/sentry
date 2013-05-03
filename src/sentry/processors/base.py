"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.tasks.post_process import post_process_group


__all__ = ('send_group_processors',)


def send_group_processors(group, event, **kwargs):
    post_process_group.delay(group=group, event=event, **kwargs)
