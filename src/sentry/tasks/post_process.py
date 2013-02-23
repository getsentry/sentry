"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from sentry.plugins import plugins
from sentry.utils.safe import safe_execute
from sentry.utils.queue import maybe_delay


@task(ignore_result=True)
def post_process_group(group, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    for plugin in plugins.all():
        if safe_execute(plugin.is_enabled, group.project):
            maybe_delay(plugin_post_process_group,
                plugin.slug, group=group, **kwargs)


@task(ignore_result=True)
def plugin_post_process_group(plugin_slug, group, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, group=group, **kwargs)
