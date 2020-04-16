from __future__ import absolute_import

import functools
import itertools
import logging
import six

from collections import OrderedDict, defaultdict, namedtuple
from six.moves import reduce

from sentry.app import tsdb
from sentry.digests import Record
from sentry.models import Project, Group, GroupStatus, Rule
from sentry.utils import metrics
from sentry.utils.dates import to_timestamp

logger = logging.getLogger("sentry.digests")

Notification = namedtuple("Notification", "event rules")


def split_key(key):
    from sentry.mail.adapter import ActionTargetType

    key_parts = key.split(":", 4)
    project_id = key_parts[2]
    if len(key_parts) == 5:
        target_type = ActionTargetType(key_parts[3])
        target_identifier = key_parts[4] if key_parts[4] else None
        metrics.incr("digests.new_key_seen")
    else:
        metrics.incr("digests.old_key_seen")

        target_type = ActionTargetType.ISSUE_OWNERS
        target_identifier = None
    return Project.objects.get(pk=project_id), target_type, target_identifier


def unsplit_key(project, target_type, target_identifier):
    return u"mail:p:{}:{}:{}".format(
        project.id, target_type.value, target_identifier if target_identifier is not None else ""
    )


def event_to_record(event, rules):
    if not rules:
        logger.warning("Creating record for %r that does not contain any rules!", event)

    return Record(
        event.event_id,
        Notification(event, [rule.id for rule in rules]),
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
        "project": project,
        "groups": groups,
        "rules": Rule.objects.in_bulk(
            itertools.chain.from_iterable(record.value.rules for record in records)
        ),
        "event_counts": tsdb.get_sums(tsdb.models.group, groups.keys(), start, end),
        "user_counts": tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group, groups.keys(), start, end
        ),
    }


def attach_state(project, groups, rules, event_counts, user_counts):
    for id, group in six.iteritems(groups):
        assert group.project_id == project.id, "Group must belong to Project"
        group.project = project
        group.event_count = 0
        group.user_count = 0

    for id, rule in six.iteritems(rules):
        assert rule.project_id == project.id, "Rule must belong to Project"
        rule.project = project

    for id, event_count in six.iteritems(event_counts):
        groups[id].event_count = event_count

    for id, user_count in six.iteritems(user_counts):
        groups[id].user_count = user_count

    return {"project": project, "groups": groups, "rules": rules}


class Pipeline(object):
    def __init__(self):
        self.operations = []

    def __call__(self, sequence):
        return reduce(lambda x, operation: operation(x), self.operations, sequence)

    def apply(self, function):
        def operation(sequence):
            result = function(sequence)
            logger.debug("%r applied to %s items.", function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def filter(self, function):
        def operation(sequence):
            result = [s for s in sequence if function(s)]
            logger.debug("%r filtered %s items to %s.", function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self

    def map(self, function):
        def operation(sequence):
            result = [function(s) for s in sequence]
            logger.debug("%r applied to %s items.", function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def reduce(self, function, initializer):
        def operation(sequence):
            result = reduce(function, sequence, initializer(sequence))
            logger.debug("%r reduced %s items to %s.", function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self


def rewrite_record(record, project, groups, rules):
    event = record.value.event

    # Reattach the group to the event.
    group = groups.get(event.group_id)
    if group is not None:
        event.group = group
    else:
        logger.debug("%r could not be associated with a group.", record)
        return

    return Record(
        record.key,
        Notification(event, [_f for _f in [rules.get(id) for id in record.value.rules] if _f]),
        record.timestamp,
    )


def group_records(groups, record):
    group = record.value.event.group
    rules = record.value.rules
    if not rules:
        logger.debug("%r has no associated rules, and will not be added to any groups.", record)

    for rule in rules:
        groups[rule][group].append(record)

    return groups


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
        )
    )


def build_digest(project, records, state=None):
    records = list(records)
    if not records:
        return

    # XXX: This is a hack to allow generating a mock digest without actually
    # doing any real IO!
    if state is None:
        state = fetch_state(project, records)

    state = attach_state(**state)

    def check_group_state(record):
        return record.value.event.group.get_status() == GroupStatus.UNRESOLVED

    pipeline = (
        Pipeline()
        .map(functools.partial(rewrite_record, **state))
        .filter(bool)
        .filter(check_group_state)
        .reduce(group_records, lambda sequence: defaultdict(lambda: defaultdict(list)))
        .apply(sort_group_contents)
        .apply(sort_rule_groups)
    )

    return pipeline(records)
