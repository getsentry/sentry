"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(ignore_result=True)
def post_process_group(group, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    from sentry.plugins import plugins
    from sentry.utils.safe import safe_execute

    for plugin in plugins.all():
        if safe_execute(plugin.is_enabled, group.project):
            safe_execute(plugin.post_process, group=group, **kwargs)
