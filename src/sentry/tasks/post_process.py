"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
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
    from sentry import app
    from sentry.models import TrackedUser, AffectedUserByGroup

    user_ident = event.user_ident
    if not user_ident:
        return

    data = event.data.get('sentry.interfaces.User')

    project = group.project
    date = group.last_seen

    if data:
        email = data.get('email')
    else:
        email = None

    # TODO: we should be able to chain the affected user update so that tracked
    # user gets updated serially
    tuser, created = TrackedUser.objects.get_or_create(
        project=project,
        ident=user_ident,
        defaults={
            'email': email,
            'data': data,
            'num_events': 1,
            'last_seen': date,
        }
    )

    if not created:
        app.buffer.incr(TrackedUser, {
            'num_events': 1,
        }, {
            'id': tuser.id,
        }, {
            'last_seen': date,
            'email': email,
            'data': data,
        })

    app.buffer.incr(AffectedUserByGroup, {
        'times_seen': 1,
    }, {
        'group': group,
        'project': project,
        'tuser': tuser,
    }, {
        'last_seen': date,
    })
