"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.tasks.post_process import post_process_group
from sentry.utils.queue import maybe_delay


__all__ = ('send_group_processors',)


def send_group_processors(group, **kwargs):
    maybe_delay(post_process_group, group=group, **kwargs)
