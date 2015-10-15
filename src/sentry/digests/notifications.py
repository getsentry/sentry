from __future__ import absolute_import

import functools
import itertools
import logging
from collections import (
    OrderedDict,
    defaultdict,
    namedtuple,
)

from sentry.app import tsdb
from sentry.digests import Record
from sentry.models import (
    Project,
    Group,
    GroupStatus,
    Rule,
)
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


def event_to_record(event, rules):
    if not rules:
        logger.warning('Creating record for %r that does not contain any rules!', event)

    return Record(
        event.event_id,
        Notification(strip_for_serialization(event), [rule.id for rule in rules]),
        to_timestamp(event.datetime),
    )


def fetch_state(project, records):
    # This reads a little strange, but remember that records are returned in
    # reverse chronological order, and we query the database in chronological
    # order.
    # NOTE: This doesn't account for any issues that are filtered out later.
    start = records[-1].datetime
    end = records[0].datetime

    groups = Group.objects.in_bulk(record.value.event.group_id for record in records)
    return {
        'project': project,
        'groups': groups,
        'rules': Rule.objects.in_bulk(itertools.chain.from_iterable(record.value.rules for record in records)),
        'event_counts': tsdb.get_sums(tsdb.models.group, groups.keys(), start, end),
        'user_counts': tsdb.get_distinct_counts_totals(tsdb.models.users_affected_by_group, groups.keys(), start, end),
    }


def attach_state(project, groups, rules, event_counts, user_counts):
    for id, group in groups.iteritems():
        assert group.project_id == project.id, 'Group must belong to Project'
        group.project = project

    for id, rule in rules.iteritems():
        assert rule.project_id == project.id, 'Rule must belong to Project'
        rule.project = project

    for id, event_count in event_counts.iteritems():
        groups[id].event_count = event_count

    for id, user_count in user_counts.iteritems():
        groups[id].user_count = user_count

    return {
        'project': project,
        'groups': groups,
        'rules': rules,
    }


def rewrite_record(record, project, groups, rules):
    event = record.value.event
    group = groups.get(event.group_id)
    if group is None:
        return

    event.group = group

    return Record(
        record.key,
        Notification(
            event,
            filter(None, [rules.get(id) for id in record.value.rules]),
        ),
        record.timestamp,
    )


def group_records(records):
    results = defaultdict(lambda: defaultdict(list))
    for record in records:
        group = record.value.event.group
        for rule in record.value.rules:
            results[rule][group].append(record)

    return results


def sort_groups(grouped):
    def sort_by_events(groups):
        return OrderedDict(
            sorted(
                groups.items(),
                key=lambda (group, records): (group.event_count, group.user_count),
                reverse=True,
            ),
        )

    def sort_by_groups(rules):
        return OrderedDict(
            sorted(
                rules.items(),
                key=lambda (rule, groups): len(groups),
                reverse=True,
            ),
        )

    return sort_by_groups({rule: sort_by_events(groups) for rule, groups in grouped.iteritems()})


def build_digest(project, records, state=None):
    records = list(records)
    if not records:
        return

    # XXX: This is a hack to allow generating a mock digest without actually
    # doing any real IO!
    if state is None:
        state = fetch_state(project, records)

    state = attach_state(**state)
    records = filter(None, map(functools.partial(rewrite_record, **state), records))
    records = filter(lambda record: record.value.event.group.get_status() is GroupStatus.UNRESOLVED, records)
    return sort_groups(group_records(records))
