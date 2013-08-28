"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from hashlib import md5

from django.conf import settings
from sentry.plugins import plugins
from sentry.utils.safe import safe_execute


@task(name='sentry.tasks.post_process.post_process_group', queue='triggers')
def post_process_group(group, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    for plugin in plugins.for_project(group.project):
        plugin_post_process_group.delay(
            plugin.slug, group=group, event=event, **kwargs)

    record_affected_code.delay(group=group, event=event)
    record_affected_user.delay(group=group, event=event)


@task(
    name='sentry.tasks.post_process.plugin_post_process_group',
    queue='triggers')
def plugin_post_process_group(plugin_slug, group, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, group=group, **kwargs)


@task(
    name='sentry.tasks.post_process.record_affected_user',
    queue='triggers')
def record_affected_user(group, event, **kwargs):
    from sentry.models import Group

    if not settings.SENTRY_ENABLE_EXPLORE_USERS:
        return

    user_ident = event.user_ident
    if not user_ident:
        return

    user_data = event.data.get('sentry.interfaces.User', {})

    Group.objects.add_tags(group, [
        ('sentry:user', user_ident, {
            'id': user_data.get('id'),
            'email': user_data.get('email'),
            'username': user_data.get('username'),
            'data': user_data.get('data'),
            'ip': event.ip_address,
        })
    ])


@task(
    name='sentry.tasks.post_process.record_affected_code',
    queue='triggers')
def record_affected_code(group, event, **kwargs):
    from sentry.models import Group

    if not settings.SENTRY_ENABLE_EXPLORE_CODE:
        return

    data = event.interfaces.get('sentry.interfaces.Exception')
    if not data:
        return

    checksum = lambda x: md5(x).hexdigest()

    tags = []
    for exception in data:
        if not exception.stacktrace:
            continue

        for frame in exception.stacktrace:
            # we only tag explicit app frames to avoid excess fat
            if not frame.in_app:
                continue

            filename = frame.filename or frame.module
            if not filename:
                continue

            tags.append((
                'sentry:filename',
                checksum(filename),
                {'filename': filename},
            ))

            function = frame.function
            if function:
                tags.append((
                    'sentry:function',
                    checksum('%s:%s' % (filename, function)),
                    {'filename': filename, 'function': function}
                ))

    if tags:
        Group.objects.add_tags(group, tags)
