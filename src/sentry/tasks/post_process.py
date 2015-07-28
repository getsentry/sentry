"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

from celery.utils.log import get_task_logger
from django.conf import settings
from hashlib import md5

from sentry.constants import PLATFORM_LIST, PLATFORM_ROOTS
from sentry.plugins import plugins
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

logger = get_task_logger(__name__)


def _capture_stats(event, is_new):
    group = event.group
    platform = group.platform or group.project.platform
    if not platform:
        return
    platform = PLATFORM_ROOTS.get(platform, platform)
    if platform not in PLATFORM_LIST:
        return

    if is_new:
        metrics.incr('events.unique', 1)

    metrics.incr('events.processed', 1)
    metrics.incr('events.processed.{platform}'.format(
        platform=platform), 1)
    metrics.timing('events.size.data', len(unicode(event.data)))


@instrumented_task(
    name='sentry.tasks.post_process.post_process_group')
def post_process_group(event, is_new, is_regression, is_sample, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    from sentry.models import Project
    from sentry.rules.processor import RuleProcessor

    project = Project.objects.get_from_cache(id=event.group.project_id)

    _capture_stats(event, is_new)

    if settings.SENTRY_ENABLE_EXPLORE_CODE:
        record_affected_code.delay(event=event)

    record_affected_user.delay(event=event)

    record_additional_tags(event=event)

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
    from sentry.models import Group

    user_ident = event.user_ident
    if not user_ident:
        logger.info('No user data found for event_id=%s', event.event_id)
        return

    user_data = event.data.get('sentry.interfaces.User', event.data.get('user', {}))

    tag_data = {}
    for key in ('id', 'email', 'username', 'data'):
        value = user_data.get(key)
        if value:
            tag_data[key] = value
    ip_address = event.ip_address
    if ip_address:
        tag_data['ip'] = ip_address

    Group.objects.add_tags(event.group, [
        ('sentry:user', user_ident, tag_data)
    ])


@instrumented_task(
    name='sentry.tasks.post_process.record_affected_code')
def record_affected_code(event, **kwargs):
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
        Group.objects.add_tags(event.group, tags)
