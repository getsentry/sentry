"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging
import time

from django.conf import settings

from sentry import features
from sentry.utils import snuba
from sentry.utils.cache import cache
from sentry.plugins import plugins
from sentry.signals import event_processed
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.redis import redis_clusters
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import configure_scope

logger = logging.getLogger('sentry')


def _get_service_hooks(project_id):
    from sentry.models import ServiceHook
    cache_key = u'servicehooks:1:{}'.format(project_id)
    result = cache.get(cache_key)
    if result is None:

        result = ServiceHook.objects.filter(
            servicehookproject__project_id=project_id,
        ).values_list('id', 'events')

        cache.set(cache_key, result, 60)
    return result


def _capture_stats(event, is_new):
    # TODO(dcramer): limit platforms to... something?
    group = event.group
    platform = group.platform
    if not platform:
        return
    platform = platform.split('-', 1)[0].split('_', 1)[0]
    tags = {
        'platform': platform,
        'use_rust_normalize': event.data.get('use_rust_normalize', 'unknown')
    }

    if is_new:
        metrics.incr('events.unique', tags=tags, skip_internal=False)

    metrics.incr('events.processed', tags=tags, skip_internal=False)
    metrics.incr(u'events.processed.{platform}'.format(platform=platform), skip_internal=False)
    metrics.timing('events.size.data', event.size, tags=tags)


def check_event_already_post_processed(event):
    cluster_key = getattr(settings, 'SENTRY_POST_PROCESSING_LOCK_REDIS_CLUSTER', None)
    if cluster_key is None:
        return

    client = redis_clusters.get(cluster_key)
    result = client.set(
        u'pp:{}/{}'.format(event.project_id, event.event_id),
        u'{:.0f}'.format(time.time()),
        ex=60 * 60,
        nx=True,
    )

    return not result


@instrumented_task(name='sentry.tasks.post_process.post_process_group')
def post_process_group(event, is_new, is_regression, is_sample, is_new_group_environment, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    with snuba.options_override({'consistent': True}):
        if check_event_already_post_processed(event):
            logger.info('post_process.skipped', extra={
                'project_id': event.project_id,
                'event_id': event.event_id,
                'reason': 'duplicate',
            })
            return

        # NOTE: we must pass through the full Event object, and not an
        # event_id since the Event object may not actually have been stored
        # in the database due to sampling.
        from sentry.models import Project
        from sentry.models.group import get_group_with_redirect
        from sentry.rules.processor import RuleProcessor
        from sentry.tasks.servicehooks import process_service_hook

        # Re-bind Group since we're pickling the whole Event object
        # which may contain a stale Group.
        event.group, _ = get_group_with_redirect(event.group_id)
        event.group_id = event.group.id

        project_id = event.group.project_id
        with configure_scope() as scope:
            scope.set_tag("project", project_id)

        # Re-bind Project since we're pickling the whole Event object
        # which may contain a stale Project.
        event.project = Project.objects.get_from_cache(id=project_id)

        _capture_stats(event, is_new)

        # we process snoozes before rules as it might create a regression
        has_reappeared = process_snoozes(event.group)

        rp = RuleProcessor(event, is_new, is_regression, is_new_group_environment, has_reappeared)
        has_alert = False
        # TODO(dcramer): ideally this would fanout, but serializing giant
        # objects back and forth isn't super efficient
        for callback, futures in rp.apply():
            has_alert = True
            safe_execute(callback, event, futures)

        if features.has(
            'projects:servicehooks',
            project=event.project,
        ):
            allowed_events = set(['event.created'])
            if has_alert:
                allowed_events.add('event.alert')

            if allowed_events:
                for servicehook_id, events in _get_service_hooks(project_id=event.project_id):
                    if any(e in allowed_events for e in events):
                        process_service_hook.delay(
                            servicehook_id=servicehook_id,
                            event=event,
                        )

        for plugin in plugins.for_project(event.project):
            plugin_post_process_group(
                plugin_slug=plugin.slug,
                event=event,
                is_new=is_new,
                is_regresion=is_regression,
                is_sample=is_sample,
            )

        event_processed.send_robust(
            sender=post_process_group,
            project=event.project,
            group=event.group,
            event=event,
            primary_hash=kwargs.get('primary_hash'),
        )


def process_snoozes(group):
    """
    Return True if the group is transitioning from "resolved" to "unresolved",
    otherwise return False.
    """
    from sentry.models import GroupSnooze, GroupStatus

    try:
        snooze = GroupSnooze.objects.get_from_cache(
            group=group,
        )
    except GroupSnooze.DoesNotExist:
        return False

    if not snooze.is_valid(group, test_rates=True):
        snooze.delete()
        group.update(status=GroupStatus.UNRESOLVED)
        return True

    return False


@instrumented_task(
    name='sentry.tasks.post_process.plugin_post_process_group',
    stat_suffix=lambda plugin_slug, *a, **k: plugin_slug
)
def plugin_post_process_group(plugin_slug, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    with configure_scope() as scope:
        scope.set_tag("project", event.project_id)

    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, event=event, group=event.group, **kwargs)


@instrumented_task(
    name='sentry.tasks.index_event_tags',
    queue='events.index_event_tags',
    default_retry_delay=60 * 5,
    max_retries=None,
)
def index_event_tags(organization_id, project_id, event_id, tags,
                     group_id, environment_id, date_added=None, **kwargs):
    from sentry import tagstore

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    create_event_tags_kwargs = {}
    if date_added is not None:
        create_event_tags_kwargs['date_added'] = date_added

    metrics.timing(
        'tagstore.tags_per_event',
        len(tags),
        tags={
            'organization_id': organization_id,
        }
    )

    tagstore.create_event_tags(
        project_id=project_id,
        group_id=group_id,
        environment_id=environment_id,
        event_id=event_id,
        tags=tags,
        **create_event_tags_kwargs
    )
