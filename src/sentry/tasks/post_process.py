"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from hashlib import md5

from sentry.plugins import plugins
from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute


rules_logger = logging.getLogger('sentry.errors')


@instrumented_task(
    name='sentry.tasks.post_process.post_process_group')
def post_process_group(event, is_new, is_regression, is_sample, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    from sentry.models import Project
    from sentry.rules.processor import RuleProcessor

    project = Project.objects.get_from_cache(id=event.group.project_id)

    if settings.SENTRY_ENABLE_EXPLORE_CODE:
        record_affected_code.delay(event=event)

    if settings.SENTRY_ENABLE_EXPLORE_USERS:
        record_affected_user.delay(event=event)

    for plugin in plugins.for_project(project):
        plugin_post_process_group.apply_async(
            kwargs={
                'plugin_slug': plugin.slug,
                'event': event,
                'is_new': is_new,
                'is_regresion': is_regression,
                'is_sample': is_sample,
            },
            expires=300,
        )

    rp = RuleProcessor(event, is_new, is_regression, is_sample)
    # TODO(dcramer): ideally this would fanout, but serializing giant
    # objects back and forth isn't super efficient
    for callback, futures in rp.apply():
        safe_execute(callback, event, futures)


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

    logger = record_affected_user.get_logger()

    if not settings.SENTRY_ENABLE_EXPLORE_USERS:
        logger.info('Skipping sentry:user tag due to SENTRY_ENABLE_EXPLORE_USERS')
        return

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
    tag_data['ip'] = event.ip_address

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
