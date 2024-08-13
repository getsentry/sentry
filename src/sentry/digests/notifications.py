from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import NamedTuple, TypeAlias

from sentry import tsdb
from sentry.digests.types import Notification, Record, RecordWithRuleObjects
from sentry.eventstore.models import Event
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.tsdb.base import TSDBModel

logger = logging.getLogger("sentry.digests")

Digest: TypeAlias = dict[Rule, dict[Group, list[RecordWithRuleObjects]]]


class DigestInfo(NamedTuple):
    digest: Digest
    event_counts: dict[int, int]
    user_counts: dict[int, int]


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


def event_to_record(
    event: Event, rules: Sequence[Rule], notification_uuid: str | None = None
) -> Record:
    if not rules:
        logger.warning("Creating record for %s that does not contain any rules!", event)

    return Record(
        event.event_id,
        Notification(event, [rule.id for rule in rules], notification_uuid),
        event.datetime.timestamp(),
    )


def _bind_records(
    records: Sequence[Record], groups: dict[int, Group], rules: dict[int, Rule]
) -> list[RecordWithRuleObjects]:
    ret = []
    for record in records:
        if record.value.event.group_id is None:
            continue
        group = groups.get(record.value.event.group_id)
        if group is None:
            logger.debug("%s could not be associated with a group.", record)
            continue
        elif group.get_status() != GroupStatus.UNRESOLVED:
            continue

        record.value.event.group = group

        record_rules = [
            rule
            for rule in (rules.get(rule_id) for rule_id in record.value.rules)
            if rule is not None
        ]
        ret.append(record.with_rules(record_rules))

    return ret


def _group_records(
    records: Sequence[RecordWithRuleObjects], groups: dict[int, Group], rules: dict[int, Rule]
) -> Digest:
    grouped: Digest = defaultdict(lambda: defaultdict(list))
    for record in records:
        assert record.value.event.group is not None
        for rule in record.value.rules:
            grouped[rule][record.value.event.group].append(record)
    return grouped


def _sort_digest(
    digest: Digest, event_counts: dict[int, int], user_counts: dict[int, int]
) -> Digest:
    # sort inner groups dict by (event_count, user_count) descending
    for key, rule_groups in digest.items():
        digest[key] = dict(
            sorted(
                rule_groups.items(),
                # x = (group, records)
                key=lambda x: (event_counts[x[0].id], user_counts[x[0].id]),
                reverse=True,
            )
        )

    # sort outer rules dict by number of groups (descending)
    return dict(
        sorted(
            digest.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        )
    )


def _build_digest_impl(
    records: Sequence[Record],
    groups: dict[int, Group],
    rules: dict[int, Rule],
    event_counts: dict[int, int],
    user_counts: dict[int, int],
) -> Digest:
    # sans-io implementation details
    bound_records = _bind_records(records, groups, rules)
    grouped = _group_records(bound_records, groups, rules)
    return _sort_digest(grouped, event_counts=event_counts, user_counts=user_counts)


def build_digest(project: Project, records: Sequence[Record]) -> DigestInfo:
    if not records:
        return DigestInfo({}, {}, {})

    # This reads a little strange, but remember that records are returned in
    # reverse chronological order, and we query the database in chronological
    # order.
    # NOTE: This doesn't account for any issues that are filtered out later.
    start = records[-1].datetime
    end = records[0].datetime

    groups = Group.objects.in_bulk(record.value.event.group_id for record in records)
    group_ids = list(groups)
    rules = Rule.objects.in_bulk(rule_id for record in records for rule_id in record.value.rules)

    for group_id, g in groups.items():
        assert g.project_id == project.id, "Group must belong to Project"
    for rule_id, rule in rules.items():
        assert rule.project_id == project.id, "Rule must belong to Project"

    tenant_ids = {"organization_id": project.organization_id}
    event_counts = tsdb.backend.get_sums(
        TSDBModel.group,
        group_ids,
        start,
        end,
        tenant_ids=tenant_ids,
    )
    user_counts = tsdb.backend.get_distinct_counts_totals(
        TSDBModel.users_affected_by_group,
        group_ids,
        start,
        end,
        tenant_ids=tenant_ids,
    )

    digest = _build_digest_impl(records, groups, rules, event_counts, user_counts)

    return DigestInfo(digest, event_counts, user_counts)
