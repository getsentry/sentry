"""
sentry.processors.base
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.plugins import plugins
from sentry.utils.safe import safe_execute

__all__ = ('send_group_processors',)


def send_group_processors(group, **kwargs):
    for plugin in plugins.all():
        if safe_execute(plugin.is_enabled, group.project):
            safe_execute(plugin.post_process, group=group, **kwargs)
