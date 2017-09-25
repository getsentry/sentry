"""
sentry.tasks.post_process
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import logging
import six

from django.db import IntegrityError, transaction
from raven.contrib.django.models import client as Raven

from sentry.plugins import plugins
from sentry.signals import event_processed
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

logger = logging.getLogger('sentry')


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
    metrics.incr('events.processed.{platform}'.format(platform=platform))
    metrics.timing('events.size.data', len(six.text_type(event.data)))


@instrumented_task(name='sentry.tasks.post_process.post_process_group')
def post_process_group(event, is_new, is_regression, is_sample, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    # NOTE: we must pass through the full Event object, and not an
    # event_id since the Event object may not actually have been stored
    # in the database due to sampling.
    from sentry.models import Project
    from sentry.models.group import get_group_with_redirect
    from sentry.rules.processor import RuleProcessor

    # Re-bind Group since we're pickling the whole Event object
    # which may contain a stale Group.
    event.group, _ = get_group_with_redirect(event.group_id)
    event.group_id = event.group.id

    project_id = event.group.project_id
    Raven.tags_context({
        'project': project_id,
    })

    # Re-bind Project since we're pickling the whole Event object
    # which may contain a stale Project.
    event.project = Project.objects.get_from_cache(id=project_id)

    _capture_stats(event, is_new)

    # we process snoozes before rules as it might create a regression
    process_snoozes(event.group)

    rp = RuleProcessor(event, is_new, is_regression, is_sample)
    # TODO(dcramer): ideally this would fanout, but serializing giant
    # objects back and forth isn't super efficient
    for callback, futures in rp.apply():
        safe_execute(callback, event, futures)

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
    )


def record_additional_tags(event):
    from sentry.models import Group

    added_tags = []
    for plugin in plugins.for_project(event.project, version=2):
        added_tags.extend(safe_execute(
            plugin.get_tags, event, _with_transaction=False) or ())
    if added_tags:
        Group.objects.add_tags(event.group, added_tags)


def process_snoozes(group):
    from sentry.models import GroupSnooze, GroupStatus

    try:
        snooze = GroupSnooze.objects.get_from_cache(
            group=group,
        )
    except GroupSnooze.DoesNotExist:
        return

    if not snooze.is_valid(group, test_rates=True):
        snooze.delete()
        group.update(status=GroupStatus.UNRESOLVED)


@instrumented_task(
    name='sentry.tasks.post_process.plugin_post_process_group',
    stat_suffix=lambda plugin_slug, *a, **k: plugin_slug
)
def plugin_post_process_group(plugin_slug, event, **kwargs):
    """
    Fires post processing hooks for a group.
    """
    Raven.tags_context({
        'project': event.project_id,
    })
    plugin = plugins.get(plugin_slug)
    safe_execute(plugin.post_process, event=event, group=event.group, **kwargs)


@instrumented_task(
    name='sentry.tasks.index_event_tags', default_retry_delay=60 * 5, max_retries=None
)
def index_event_tags(organization_id, project_id, event_id, tags, group_id=None, **kwargs):
    from sentry.models import EventTag, TagKey, TagValue

    Raven.tags_context({
        'project': project_id,
    })

    for key, value in tags:
        tagkey, _ = TagKey.objects.get_or_create(
            project_id=project_id,
            key=key,
        )

        tagvalue, _ = TagValue.objects.get_or_create(
            project_id=project_id,
            key=key,
            value=value,
        )

        try:
            # handle replaying of this task
            with transaction.atomic():
                EventTag.objects.create(
                    project_id=project_id,
                    group_id=group_id,
                    event_id=event_id,
                    key_id=tagkey.id,
                    value_id=tagvalue.id,
                )
        except IntegrityError:
            pass
