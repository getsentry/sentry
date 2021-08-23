import functools
import itertools
import logging
from collections import OrderedDict, defaultdict, namedtuple
from functools import reduce
from typing import (
    Any,
    Callable,
    Mapping,
    MutableMapping,
    MutableSequence,
    Optional,
    Sequence,
    Tuple,
)

from sentry.app import tsdb
from sentry.digests import Record
from sentry.eventstore.models import Event
from sentry.models import Group, GroupStatus, Project, Rule
from sentry.notifications.types import ActionTargetType
from sentry.utils.dates import to_timestamp

logger = logging.getLogger("sentry.digests")

Notification = namedtuple("Notification", "event rules")


def split_key(key: str) -> Tuple["Project", "ActionTargetType", Optional[str]]:
    key_parts = key.split(":", 4)
    project_id = key_parts[2]
    # XXX: We transitioned to new style keys (len == 5) a while ago on sentry.io. But
    # on-prem users might transition at any time, so we need to keep this transition
    # code around for a while, maybe indefinitely.
    if len(key_parts) == 5:
        target_type = ActionTargetType(key_parts[3])
        target_identifier = key_parts[4] if key_parts[4] else None
    else:
        target_type = ActionTargetType.ISSUE_OWNERS
        target_identifier = None
    return Project.objects.get(pk=project_id), target_type, target_identifier


def unsplit_key(
    project: "Project", target_type: ActionTargetType, target_identifier: Optional[str]
) -> str:
    return "mail:p:{}:{}:{}".format(
        project.id, target_type.value, target_identifier if target_identifier is not None else ""
    )


def event_to_record(event: Event, rules: Sequence[Rule]) -> Record:
    if not rules:
        logger.warning("Creating record for %r that does not contain any rules!", event)

    return Record(
        event.event_id,
        Notification(event, [rule.id for rule in rules]),
        to_timestamp(event.datetime),
    )


def fetch_state(project: "Project", records: Sequence[Record]) -> Mapping[str, Any]:
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
        "event_counts": tsdb.get_sums(tsdb.models.group, list(groups.keys()), start, end),
        "user_counts": tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group, list(groups.keys()), start, end
        ),
    }


def attach_state(
    project: "Project",
    groups: MutableMapping[int, "Group"],
    rules: Mapping[int, Rule],
    event_counts: Mapping[int, int],
    user_counts: Mapping[int, int],
) -> Mapping[str, Any]:
    for id, group in groups.items():
        assert group.project_id == project.id, "Group must belong to Project"
        group.project = project
        group.event_count = 0
        group.user_count = 0

    for id, rule in rules.items():
        assert rule.project_id == project.id, "Rule must belong to Project"
        rule.project = project

    for id, event_count in event_counts.items():
        groups[id].event_count = event_count

    for id, user_count in user_counts.items():
        groups[id].user_count = user_count

    return {"project": project, "groups": groups, "rules": rules}


class Pipeline:
    def __init__(self) -> None:
        self.operations: MutableSequence[Callable[..., Any]] = []

    def __call__(self, sequence: Sequence[Any]) -> Any:
        # Explicitly typing to satisfy mypy.
        func: Callable[[Any, Callable[[Any], Any]], Any] = lambda x, operation: operation(x)
        return reduce(func, self.operations, sequence)

    def apply(self, function: Callable[[MutableMapping[str, Any]], Any]) -> "Pipeline":
        def operation(sequence: MutableMapping[str, Any]) -> Any:
            result = function(sequence)
            logger.debug("%r applied to %s items.", function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def filter(self, function: Callable[[Record], bool]) -> "Pipeline":
        def operation(sequence: Sequence[Any]) -> Sequence[Any]:
            result = [s for s in sequence if function(s)]
            logger.debug("%r filtered %s items to %s.", function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self

    def map(self, function: Callable[[Sequence[Any]], Any]) -> "Pipeline":
        def operation(sequence: Sequence[Any]) -> Sequence[Any]:
            result = [function(s) for s in sequence]
            logger.debug("%r applied to %s items.", function, len(sequence))
            return result

        self.operations.append(operation)
        return self

    def reduce(
        self, function: Callable[[Any, Any], Any], initializer: Callable[[Sequence[Any]], Any]
    ) -> "Pipeline":
        def operation(sequence: Sequence[Any]) -> Any:
            result = reduce(function, sequence, initializer(sequence))
            logger.debug("%r reduced %s items to %s.", function, len(sequence), len(result))
            return result

        self.operations.append(operation)
        return self


def rewrite_record(
    record: Record,
    project: "Project",
    groups: Mapping[int, "Group"],
    rules: Mapping[str, Rule],
) -> Optional[Record]:
    event = record.value.event

    # Reattach the group to the event.
    group = groups.get(event.group_id)
    if group is not None:
        event.group = group
    else:
        logger.debug("%r could not be associated with a group.", record)
        return None

    return Record(
        record.key,
        Notification(event, [_f for _f in [rules.get(id) for id in record.value.rules] if _f]),
        record.timestamp,
    )


def group_records(
    groups: MutableMapping[str, Mapping[str, MutableSequence[Record]]], record: Record
) -> Mapping[str, Mapping[str, Sequence[Record]]]:
    group = record.value.event.group
    rules = record.value.rules
    if not rules:
        logger.debug("%r has no associated rules, and will not be added to any groups.", record)

    for rule in rules:
        groups[rule][group].append(record)

    return groups


def sort_group_contents(
    rules: MutableMapping[str, Mapping["Group", Sequence[Record]]]
) -> Mapping[str, Mapping["Group", Sequence[Record]]]:
    for key, groups in rules.items():
        rules[key] = OrderedDict(
            sorted(
                groups.items(),
                # x = (group, records)
                key=lambda x: (x[0].event_count, x[0].user_count),
                reverse=True,
            )
        )
    return rules


def sort_rule_groups(rules: Mapping[str, Rule]) -> Mapping[str, Rule]:
    return OrderedDict(
        sorted(
            rules.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        )
    )


def build_digest(
    project: "Project",
    records: Sequence[Record],
    state: Optional[Mapping[str, Any]] = None,
) -> Optional[Any]:
    records = list(records)
    if not records:
        return None

    # XXX: This is a hack to allow generating a mock digest without actually
    # doing any real IO!
    if state is None:
        state = fetch_state(project, records)

    state = attach_state(**state)

    def check_group_state(record: Record) -> bool:
        # Explicitly typing to satisfy mypy.
        is_unresolved: bool = record.value.event.group.get_status() == GroupStatus.UNRESOLVED
        return is_unresolved

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
