from collections import Counter, OrderedDict, defaultdict
from datetime import datetime
from typing import Counter as CounterType
from typing import Iterable, Mapping, MutableMapping, Optional, Set, Tuple

from sentry.digests import Digest
from sentry.eventstore.models import Event
from sentry.models import ActorTuple, OrganizationMemberTeam, ProjectOwnership, Team, User
from sentry.notifications.types import ActionTargetType


def get_digest_metadata(
    digest: Digest,
) -> Tuple[Optional[datetime], Optional[datetime], CounterType[str]]:
    """TODO(mgaeta): This should probably just be part of `build_digest`."""
    start: Optional[datetime] = None
    end: Optional[datetime] = None

    counts: CounterType[str] = Counter()
    for rule, groups in digest.items():
        counts.update(groups.keys())

        for group, records in groups.items():
            for record in records:
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


def get_personalized_digests(
    target_type: ActionTargetType, project_id: int, digest: Digest, user_ids: Iterable[int]
) -> Iterable[Tuple[int, Digest]]:
    """
    TODO(mgaeta): I know this is inefficient. In the case that ProjectOwnership
     does exist, I do the same query twice. Once with this statement and again
     with the call to ProjectOwnership.get_actors(). I "will" follow up with
     another PR to reduce the number of queries.
    """
    if (
        target_type == ActionTargetType.ISSUE_OWNERS
        and ProjectOwnership.objects.filter(project_id=project_id).exists()
    ):
        events = get_event_from_groups_in_digest(digest)
        events_by_actor = build_events_by_actor(project_id, events, user_ids)
        events_by_user = convert_actors_to_users(events_by_actor, user_ids)
        for user_id, user_events in events_by_user.items():
            yield user_id, build_custom_digest(digest, user_events)
    else:
        for user_id in user_ids:
            yield user_id, digest


def get_event_from_groups_in_digest(digest: Digest) -> Iterable[Event]:
    """Gets the first event from each group in the digest."""
    events = set()
    for rule_groups in digest.values():
        for group_records in rule_groups.values():
            events.add(group_records[0].value.event)
    return events


def build_custom_digest(original_digest: Digest, events: Iterable[Event]) -> Digest:
    user_digest = OrderedDict()
    for rule, rule_groups in original_digest.items():
        user_rule_groups = OrderedDict()
        for group, group_records in rule_groups.items():
            user_group_records = [
                record for record in group_records if record.value.event in events
            ]
            if user_group_records:
                user_rule_groups[group] = user_group_records
        if user_rule_groups:
            user_digest[rule] = user_rule_groups
    return user_digest


def build_events_by_actor(
    project_id: int, events: Iterable[Event], user_ids: Iterable[int]
) -> Mapping[ActorTuple, Iterable[Event]]:
    """
    TODO(mgaeta): I know this is inefficient. ProjectOwnership.get_owners
     is O(n) queries and I'm doing that O(len(events)) times. I "will"
     create a follow-up PR to address this method's efficiency problem.
     Just wanted to make as few changes as possible for now.
    """
    events_by_actor: MutableMapping[ActorTuple, Set[Event]] = defaultdict(set)
    for event in events:
        actors, __ = ProjectOwnership.get_owners(project_id, event.data)
        if actors == ProjectOwnership.Everyone:
            actors = [ActorTuple(user_id, User) for user_id in user_ids]
        for actor in actors:
            events_by_actor[actor].add(event)
    return events_by_actor


def convert_actors_to_users(
    events_by_actor: Mapping[ActorTuple, Iterable[Event]], user_ids: Iterable[int]
) -> Mapping[int, Iterable[Event]]:
    events_by_user: MutableMapping[int, Set[Event]] = defaultdict(set)
    team_actors = [actor for actor in events_by_actor.keys() if actor.type == Team]
    teams_to_user_ids = team_actors_to_user_ids(team_actors, user_ids)
    for actor, events in events_by_actor.items():
        if actor.type == Team:
            try:
                team_user_ids = teams_to_user_ids[actor.id]
            except KeyError:
                pass
            else:
                for user_id in team_user_ids:
                    events_by_user[user_id].update(events)
        elif actor.type == User:
            events_by_user[actor.id].update(events)
        else:
            raise ValueError("Unknown Actor type: %s" % actor.type)
    return events_by_user


def team_actors_to_user_ids(
    team_actors: Iterable[ActorTuple], user_ids: Iterable[int]
) -> Mapping[int, Iterable[int]]:
    """Will not include a team in the result if there are no active members in a team."""
    team_ids = [actor.id for actor in team_actors]
    members = OrganizationMemberTeam.objects.filter(
        team_id__in=team_ids, is_active=True, organizationmember__user_id__in=user_ids
    ).select_related("organizationmember")

    team_members = defaultdict(set)
    for member in members:
        user_id = member.organizationmember.user_id
        team_members[member.team_id].add(user_id)

    return team_members
