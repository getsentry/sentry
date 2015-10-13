from __future__ import absolute_import

import logging
from collections import namedtuple

from django.utils import timezone

from sentry.app import tsdb
from sentry.digests import Record
from sentry.models import Project
from sentry.utils.dates import to_timestamp


logger = logging.getLogger('sentry.digests')


Notification = namedtuple('Notification', 'event rules')


def split_key(key):
    from sentry.plugins import plugins  # XXX
    plugin_slug, _, project_id = key.split(':', 2)
    return plugins.get(plugin_slug), Project.objects.get(pk=project_id)


def unsplit_key(plugin, project):
    return '{plugin.slug}:p:{project.id}'.format(plugin=plugin, project=project)


def strip_for_serialization(instance):
    cls = type(instance)
    return cls(**{field.attname: getattr(instance, field.attname) for field in cls._meta.fields})


def event_to_record(event, rules, clean=strip_for_serialization):
    if not rules:
        logger.warning('Creating record for %r that does not contain any rules!', event)

    return Record(
        event.event_id,
        Notification(clean(event), [rule.id for rule in rules]),
        to_timestamp(event.datetime),
    )


Digest = namedtuple('Digest', 'start end rules')
Summary = namedtuple('Summary', 'records events users')


def build_digest(project, records):
    # Extract all groups from the records.
    groups = set()
    for record in records:
        groups.add(record.value.event.group_id)

    start = records[-1].datetime
    end = timezone.now()

    # Fetch the event counts for all groups.
    events = tsdb.get_sums(
        tsdb.models.group,
        groups,
        start,
        end,
    )

    # Fetch the user counts for all groups.
    users = tsdb.get_distinct_counts_totals(
        tsdb.models.users_affected_by_group,
        groups,
        start,
        end,
    )

    # Group the records by [rule][group].
    groups_by_rule = {}
    for record in records:
        for rule in record.value.rules:
            group = record.value.event.group
            summary = groups_by_rule.setdefault(rule, {}).get(group)
            if summary is None:
                summary = groups_by_rule[rule][group] = Summary(
                    [],
                    events[group.id],
                    users[group.id],
                )
            summary.records.append(record)

    # TODO: Filter out any groups that are muted or resolved?

    results = sorted(
        [
            (
                rule,
                sorted(
                    summaries.items(),
                    key=lambda (group, summary): summary.events,
                    reverse=True,
                )
            )
            for rule, summaries in
            groups_by_rule.items()
        ],
        key=lambda (rule, groups): len(groups),
        reverse=True,
    )

    return Digest(start, end, results)
