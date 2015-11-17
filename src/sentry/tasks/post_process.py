"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

from celery.utils.log import get_task_logger
from django.db import IntegrityError, transaction
from raven.contrib.django.models import client as Raven

from sentry.plugins import plugins
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

logger = get_task_logger(__name__)


def _capture_stats(event, is_new):
    # TODO(dcramer): limit platforms to... something?
    group = event.group
    platform = group.platform
    if not platform:
        return
    platform = platform.split('-', 1)[0].split('_', 1)[0]

    if is_new:
        metrics.incr('events.unique')

    metrics.incr('events.processed')
    metrics.incr('events.processed.{platform}'.format(
        platform=platform))
    metrics.timing('events.size.data', len(unicode(event.data)))


@instrumented_task(
    name='sentry.tasks.post_process.post_process_group')
def post_process_group(event, is_new, is_regression, is_sample, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    from sentry.models import Project
    from sentry.rules.processor import RuleProcessor

    project_id = event.group.project_id
    Raven.tags_context({
        'project': project_id,
    })

    project = Project.objects.get_from_cache(id=project_id)

    _capture_stats(event, is_new)

    rp = RuleProcessor(event, is_new, is_regression, is_sample)
    # TODO(dcramer): ideally this would fanout, but serializing giant
    # objects back and forth isn't super efficient
    for callback, futures in rp.apply():
        safe_execute(callback, event, futures)

    for plugin in plugins.for_project(project):
        plugin_post_process_group(
            plugin_slug=plugin.slug,
            event=event,
            is_new=is_new,
            is_regresion=is_regression,
            is_sample=is_sample,
        )


def record_additional_tags(event):
    from sentry.models import Group

    added_tags = []
    for plugin in plugins.for_project(event.project, version=2):
        added_tags.extend(safe_execute(plugin.get_tags, event) or ())
    if added_tags:
        Group.objects.add_tags(event.group, added_tags)


@instrumented_task(
    name='sentry.tasks.post_process.plugin_post_process_group',
    stat_suffix=lambda plugin_slug, *a, **k: plugin_slug)
def plugin_post_process_group(plugin_slug, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, event=event, group=event.group, **kwargs)


@instrumented_task(
    name='sentry.tasks.post_process.record_affected_user')
def record_affected_user(event, **kwargs):
    from sentry.models import EventUser, Group

    user_data = event.data.get('sentry.interfaces.User', event.data.get('user'))
    if not user_data:
        logger.info('No user data found for event_id=%s', event.event_id)
        return

    euser = EventUser(
        project=event.project,
        ident=user_data.get('id'),
        email=user_data.get('email'),
        username=user_data.get('username'),
        ip_address=user_data.get('ip_address'),
    )

    if not euser.tag_value:
        # no ident, bail
        logger.info('No identifying value found for user on event_id=%s',
                    event.event_id)
        return

    try:
        with transaction.atomic():
            euser.save()
    except IntegrityError:
        pass

    Group.objects.add_tags(event.group, [
        ('sentry:user', euser.tag_value)
    ])
