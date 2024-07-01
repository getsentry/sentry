from __future__ import annotations

import itertools
import logging
from collections import defaultdict
from collections.abc import Sequence

from sentry import tsdb
from sentry.digests import Digest, Notification, Record
from sentry.eventstore.models import Event
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.tsdb.base import TSDBModel

logger = logging.getLogger("sentry.digests")


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


def build_digest(
    project: Project,
    records: Sequence[Record],
) -> tuple[Digest | None, list[str]]:
    if not records:
        return None, []

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

    for group_id, group in groups.items():
        assert group.project_id == project.id, "Group must belong to Project"
    for rule_id, rule in rules.items():
        assert rule.project_id == project.id, "Rule must belong to Project"

    tenant_ids = {"organization_id": project.organization_id}
    event_counts = tsdb.backend.get_sums(
        TSDBModel.group,
        list(groups),
        start,
        end,
        tenant_ids=tenant_ids,
    )
    user_counts = tsdb.backend.get_distinct_counts_totals(
        TSDBModel.users_affected_by_group,
        list(groups),
        start,
        end,
        tenant_ids=tenant_ids,
    )

    grouped: Digest = defaultdict(lambda: defaultdict(list))
    for record in records:
        # Reattach the group to the event.
        group = groups.get(record.value.event.group_id)
        if group is not None:
            record.value.event.group = group
        else:
            logger.debug("%s could not be associated with a group.", record)
            continue

        if record.value.event.group.get_status() != GroupStatus.UNRESOLVED:
            continue

        record_rules = [_f for _f in (rules.get(rule_id) for rule_id in record.value.rules) if _f]

        if not record_rules:
            logger.debug("%s has no associated rules, and will not be added to any groups.", record)

        for rule in record_rules:
            grouped[rule][group].append(record)

    for key, groups in rules.items():
        grouped[key] = dict(
            sorted(
                groups.items(),
                # x = (group, records)
                key=lambda x: (event_counts[x[0].id], user_counts[x[0].id]),
                reverse=True,
            )
        )

    grouped = dict(
        sorted(
            rules.items(),
            # x = (rule, groups)
            key=lambda x: len(x[1]),
            reverse=True,
        )
    )
    return grouped, []
