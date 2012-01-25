"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.plugins import plugins

__all__ = ('send_group_processors',)


def send_group_processors(**kwargs):
    for processor in plugins.all():
        processor.post_process(**kwargs)
