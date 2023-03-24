from __future__ import annotations

import functools
import itertools
import logging
from collections import defaultdict, namedtuple
from typing import Any, Mapping, MutableMapping, MutableSequence, Sequence

from sentry import tsdb
from sentry.digests import Digest, Record
from sentry.eventstore.models import Event
from sentry.models import Group, GroupStatus, Project, Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.utils.dates import to_timestamp
from sentry.utils.pipeline import Pipeline

logger = logging.getLogger("sentry.digests")

Notification = namedtuple("Notification", "event rules")


def split_key(
    key: str,
) -> tuple[Project, ActionTargetType, str | None, FallthroughChoiceType | None]:
    key_parts = key.split(":", 5)
    project_id = key_parts[2]
    # XXX: We transitioned to new style keys (len == 5) a while ago on
    # sentry.io. But self-hosted users might transition at any time, so we need
    # to keep this transition code around for a while, maybe indefinitely.
    if len(key_parts) == 6:
        target_type = ActionTargetType(key_parts[3])
        target_identifier = key_parts[4] if key_parts[4] else None
        try:
            fallthrough_choice = FallthroughChoiceType(key_parts[5])
        except ValueError:
            fallthrough_choice = None
    elif len(key_parts) == 5:
        target_type = ActionTargetType(key_parts[3])
        target_identifier = key_parts[4] if key_parts[4] else None
        fallthrough_choice = None
    else:
        target_type = ActionTargetType.ISSUE_OWNERS
        target_identifier = None
        fallthrough_choice = None
    return Project.objects.get(pk=project_id), target_type, target_identifier, fallthrough_choice


def unsplit_key(
    project: Project,
    target_type: ActionTargetType,
    target_identifier: str | None,
    fallthrough_choice: FallthroughChoiceType | None,
) -> str:
    target_str = target_identifier if target_identifier is not None else ""
    fallthrough = fallthrough_choice.value if fallthrough_choice is not None else ""
    return f"mail:p:{project.id}:{target_type.value}:{target_str}:{fallthrough}"


def event_to_record(event: Event, rules: Sequence[Rule]) -> Record:
    if not rules:
        logger.warning(f"Creating record for {event} that does not contain any rules!")

    return Record(
        event.event_id,
        Notification(event, [rule.id for rule in rules]),
        to_timestamp(event.datetime),
    )


def fetch_state(project: Project, records: Sequence[Record]) -> Mapping[str, Any]:
    # This reads a little strange, but remember that records are returned in
    # reverse chronological order, and we query the database in chronological
    # order.
    # NOTE: This doesn't account for any issues that are filtered out later.
    start = records[-1].datetime
    end = records[0].datetime

    groups = Group.objects.in_bulk(record.value.event.group_id for record in records)
    tenant_ids = {"organization_id": project.organization_id}
    return {
        "project": project,
        "groups": groups,
        "rules": Rule.objects.in_bulk(
            itertools.chain.from_iterable(record.value.rules for record in records)
        ),
        "event_counts": tsdb.get_sums(
            tsdb.models.group,
            list(groups.keys()),
            start,
            end,
            tenant_ids=tenant_ids,
        ),
        "user_counts": tsdb.get_distinct_counts_totals(
            tsdb.models.users_affected_by_group,
            list(groups.keys()),
            start,
            end,
            tenant_ids=tenant_ids,
        ),
    }


def attach_state(
    project: Project,
    groups: MutableMapping[int, Group],
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


def rewrite_record(
    record: Record,
    project: Project,
    groups: Mapping[int, Group],
    rules: Mapping[str, Rule],
) -> Record | None:
    event = record.value.event

    # Reattach the group to the event.
    group = groups.get(event.group_id)
    if group is not None:
        event.group = group
    else:
        logger.debug(f"{record} could not be associated with a group.")
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
        logger.debug(f"{record} has no associated rules, and will not be added to any groups.")

    for rule in rules:
        groups[rule][group].append(record)

    return groups


def sort_group_contents(
    rules: MutableMapping[str, Mapping[Group, Sequence[Record]]]
) -> Mapping[str, Mapping[Group, Sequence[Record]]]:
    for key, groups in rules.items():
        rules[key] = dict(
            sorted(
                groups.items(),
                # x = (group, records)
                key=lambda x: (x[0].event_count, x[0].user_count),
                reverse=True,
            )
        )
    return rules


def sort_rule_groups(rules: Mapping[str, Rule]) -> Mapping[str, Rule]:
    return dict(
        sorted(
            rules.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        )
    )


def check_group_state(record: Record) -> bool:
    # Explicitly typing to satisfy mypy.
    is_unresolved: bool = record.value.event.group.get_status() == GroupStatus.UNRESOLVED
    return is_unresolved


def build_digest(
    project: Project,
    records: Sequence[Record],
    state: Mapping[str, Any] | None = None,
) -> tuple[Digest | None, Sequence[str]]:
    if not records:
        return None, []

    # XXX(hack): Allow generating a mock digest without actually doing any real IO!
    state = state or fetch_state(project, records)

    pipeline = (
        Pipeline()
        .map(functools.partial(rewrite_record, **attach_state(**state)))
        .filter(bool)
        .filter(check_group_state)
        .reduce(group_records, lambda sequence: defaultdict(lambda: defaultdict(list)))
        .apply(sort_group_contents)
        .apply(sort_rule_groups)
    )

    digest, logs = pipeline(records)
    return digest, logs
