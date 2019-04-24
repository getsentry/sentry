from __future__ import absolute_import

import itertools
import logging
import six

from collections import (
    OrderedDict,
    namedtuple,
)
from six.moves import reduce

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
    return u'{plugin.slug}:p:{project.id}'.format(plugin=plugin, project=project)


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
    rules = Rule.objects.in_bulk(
        itertools.chain.from_iterable(record.value.rules for record in records)
    )
    event_counts = tsdb.get_sums(tsdb.models.group, groups.keys(), start, end)
    user_counts = tsdb.get_distinct_counts_totals(
        tsdb.models.users_affected_by_group, groups.keys(), start, end
    )

    for id, group in six.iteritems(groups):
        assert group.project_id == project.id, 'Group must belong to Project'
        group.project = project

    for id, rule in six.iteritems(rules):
        assert rule.project_id == project.id, 'Rule must belong to Project'
        rule.project = project

    for id, event_count in six.iteritems(event_counts):
        groups[id].event_count = event_count

    for id, user_count in six.iteritems(user_counts):
        groups[id].user_count = user_count

    return groups, rules


class Pipeline(object):
    def __init__(self):
        self.operations = []

    def __call__(self, sequence):
        return reduce(lambda x, operation: operation(x), self.operations, sequence)

    def apply(self, function):
        def operation(sequence):
            result = function(sequence)
            logger.debug('%r applied to %s items.', function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def filter(self, function):
        def operation(sequence):
            result = [s for s in sequence if function(s)]
            logger.debug('%r filtered %s items to %s.', function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self

    def map(self, function):
        def operation(sequence):
            result = [function(s) for s in sequence]
            logger.debug('%r applied to %s items.', function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def reduce(self, function, initializer):
        def operation(sequence):
            result = reduce(function, sequence, initializer)
            logger.debug('%r reduced %s items to %s.', function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self


def group_record(groups, rules, memo, record):
    group = groups.get(record.value.event.group_id)
    record_rules = [rules.get(id) for id in record.value.rules if id in rules]
    if not record_rules:
        logger.debug('%r has no associated rules, and will not be added to any groups.', record)

    for rule in record_rules:
        memo.setdefault(rule, {}).setdefault(group, []).append(record)

    return memo


def sort_group_contents(rules):
    for key, groups in six.iteritems(rules):
        rules[key] = OrderedDict(
            sorted(
                groups.items(),
                # x = (group, records)
                key=lambda x: (x[0].event_count, x[0].user_count),
                reverse=True,
            )
        )
    return rules


def sort_rule_groups(rules):
    return OrderedDict(
        sorted(
            rules.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        ),
    )


def build_digest(project, records):
    records = list(records)
    if not records:
        return

    groups, rules = fetch_state(project, records)

    pipeline = Pipeline(). \
        filter(lambda r: r.value.event.group_id in groups). \
        filter(lambda r: groups[r.value.event.group_id].get_status() == GroupStatus.UNRESOLVED). \
        reduce(lambda memo, record: group_record(groups, rules, memo, record), {}). \
        apply(sort_group_contents). \
        apply(sort_rule_groups)

    return pipeline(records)
