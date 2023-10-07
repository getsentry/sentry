from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Iterable, Mapping, Sequence

from django.db.models import Q

from sentry.digests import Digest, Record
from sentry.eventstore.models import Event
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.projectownership import ProjectOwnership
from sentry.models.rule import Rule
from sentry.models.rulesnooze import RuleSnooze
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.notifications.utils.participants import get_send_to
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders


def get_digest_metadata(
    digest: Digest,
) -> tuple[datetime | None, datetime | None, Counter[Group]]:
    """
    Inspect a digest down to its events and return three pieces of data:
     - the timestamp of the FIRST event chronologically
     - the timestamp of the LAST event chronologically
     - the total number of groups
    """
    start: datetime | None = None
    end: datetime | None = None

    counts: Counter[Group] = Counter()
    for rule, groups in digest.items():
        counts.update(groups.keys())

        for group, records in groups.items():
            for record in records:
                if record.datetime:
                    if start is None or record.datetime < start:
                        start = record.datetime

                    if end is None or record.datetime > end:
                        end = record.datetime

    return start, end, counts


def should_get_personalized_digests(target_type: ActionTargetType, project_id: int) -> bool:
    return (
        target_type == ActionTargetType.ISSUE_OWNERS
        and ProjectOwnership.objects.filter(project_id=project_id).exists()
    )


def get_digest_as_context(digest: Digest) -> Mapping[str, Any]:
    start, end, counts = get_digest_metadata(digest)
    group = next(iter(counts))

    return {
        "counts": counts,
        "digest": digest,
        "group": group,
        "end": end,
        "start": start,
    }


def get_events_by_participant(
    participants_by_provider_by_event: Mapping[Event, Mapping[ExternalProviders, set[RpcActor]]]
) -> Mapping[RpcActor, set[Event]]:
    """Invert a mapping of events to participants to a mapping of participants to events."""
    output = defaultdict(set)
    for event, participants_by_provider in participants_by_provider_by_event.items():
        participants: set[RpcActor]
        for participants in participants_by_provider.values():
            for participant in participants:
                output[participant].add(event)
    return output


def get_personalized_digests(
    digest: Digest,
    participants_by_provider_by_event: Mapping[Event, Mapping[ExternalProviders, set[RpcActor]]],
) -> Mapping[RpcActor, Digest]:
    events_by_participant = get_events_by_participant(participants_by_provider_by_event)

    actor_to_digest = {}

    for participant, events in events_by_participant.items():
        if participant is not None:
            custom_digest = build_custom_digest(digest, events, participant)
            if custom_digest:
                actor_to_digest[participant] = custom_digest

    return actor_to_digest


def get_event_from_groups_in_digest(digest: Digest) -> Iterable[Event]:
    """Gets a random event from each group in the digest."""
    return {
        group_records[0].value.event
        for rule_groups in digest.values()
        for group_records in rule_groups.values()
    }


def build_custom_digest(
    original_digest: Digest, events: Iterable[Event], participant: RpcActor
) -> Digest:
    """Given a digest and a set of events, filter the digest to only records that include the events."""
    user_digest: Digest = {}
    rule_snoozes = RuleSnooze.objects.filter(
        Q(user_id=participant.id) | Q(user_id__isnull=True), rule__in=original_digest.keys()
    ).values_list("rule", flat=True)
    snoozed_rule_ids = {rule for rule in rule_snoozes}

    for rule, rule_groups in original_digest.items():
        if rule.id in snoozed_rule_ids:
            continue
        user_rule_groups = {}
        for group, group_records in rule_groups.items():
            user_group_records = [
                record for record in group_records if record.value.event in events
            ]
            if user_group_records:
                user_rule_groups[group] = user_group_records
        if user_rule_groups:
            user_digest[rule] = user_rule_groups
    return user_digest


def get_participants_by_event(
    digest: Digest,
    project: Project,
    target_type: ActionTargetType = ActionTargetType.ISSUE_OWNERS,
    target_identifier: int | None = None,
    fallthrough_choice: FallthroughChoiceType | None = None,
) -> Mapping[Event, Mapping[ExternalProviders, set[RpcActor]]]:
    """
    This is probably the slowest part in sending digests because we do a lot of
    DB calls while we iterate over every event. It would be great if we could
    combine some queries.
    """
    return {
        event: get_send_to(
            project=project,
            target_type=target_type,
            target_identifier=target_identifier,
            event=event,
            fallthrough_choice=fallthrough_choice,
        )
        for event in get_event_from_groups_in_digest(digest)
    }


def sort_records(records: Sequence[Record]) -> Sequence[Record]:
    """Sorts records ordered from newest to oldest."""

    def sort_func(record: Record) -> datetime:
        return record.value.event.datetime

    return sorted(records, key=sort_func, reverse=True)


def get_groups(digest: Digest) -> Sequence[tuple[Rule, Group, Event]]:
    """
    Split a digest into groups and return it as a tuple of: the applicable
    rule, the group, and the group's first event.
    """
    return [
        (rule, group, group_records[0].value.event)
        for rule, rule_groups in digest.items()
        for group, group_records in rule_groups.items()
    ]
