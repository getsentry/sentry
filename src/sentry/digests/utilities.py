from __future__ import absolute_import

import six

from collections import Counter, OrderedDict
from sentry.models import OrganizationMemberTeam, ProjectOwnership, Team, User


# TODO(tkaemming): This should probably just be part of `build_digest`.
def get_digest_metadata(digest):
    start = None
    end = None

    counts = Counter()
    for rule, groups in six.iteritems(digest):
        counts.update(groups.keys())

        for group, records in six.iteritems(groups):
            for record in records:
                if start is None or record.datetime < start:
                    start = record.datetime

                if end is None or record.datetime > end:
                    end = record.datetime

    return start, end, counts


def get_personalized_digests(project_id, digest, user_ids):
    """
    get_personalized_digests(project: Project, digest: Digest, users: Set[User]) -> Iterator[User, Digest]
    """
    # TODO(LB): I Know this is inefficent.
    if ProjectOwnership.objects.filter(project_id=project_id).exists():
        events = get_events_from_digest(digest)
        events_by_actor = build_events_by_actor(project_id, events)
        events_by_user = convert_actors_to_user_set(events_by_actor, user_ids)
        for user_id in user_ids:
            yield user_id, build_custom_digest(digest, events_by_user[user_id])
    else:
        for user_id in user_ids:
            yield user_id, digest


def sort_records(records):
    """
    Sorts records for fetch_state method
    fetch_state is expecting these records to be ordered from newest to oldest
    """
    return sorted(records, key=lambda r: r.value.event.datetime, reverse=True)


def get_events_from_digest(digest):
    events = []
    for rule_groups in six.itervalues(digest):
        for group_records in six.itervalues(rule_groups):
            events.append(group_records[0].value.event)
    return set(events)


def build_custom_digest(original_digest, events):
    """
    build_custom_digest(original_digest: Digest, user_id: Int, events_by_users: Map[User_Id:Set(Events)]) -> Digest
    """
    user_digest = OrderedDict()
    for rule, rule_groups in six.iteritems(original_digest):
        user_rule_groups = OrderedDict()
        for group, group_records in six.iteritems(rule_groups):
            user_group_records = [
                record for record in group_records
                if record.value.event in events
            ]
            if user_group_records:
                user_rule_groups[group] = sort_records(user_group_records)
        if user_rule_groups:
            user_digest[rule] = user_rule_groups
    return user_digest


def build_events_by_actor(project_id, events):
    """
    build_events_by_actor(project_id: Int, events: Set(Events)) -> Map[Actor:Set(Events)]
    """
    events_by_actor = {}
    for event in events:
        # TODO(LB): I Know this is inefficent. Just wanted to make as few changes
        # as possible for now. Can follow up with another PR
        actors, __ = ProjectOwnership.get_owners(project_id, event.data)
        for actor in actors:
            if actor in events_by_actor:
                events_by_actor[actor].add(event)
            else:
                events_by_actor[actor] = set([event])
    return events_by_actor


def convert_actors_to_user_set(events_by_actor, user_ids):
    """
    convert_actors_to_user_set(events_by_actor: Map[Actor:Set(Events)], user_ids: List(Int)) -> Map[User_Id:Set(Events)]
    """
    user_by_events = {}
    team_actors = [actor for actor in six.iterkeys(events_by_actor) if actor.type == Team]
    teams_to_user_ids = team_actors_to_user_ids(team_actors, user_ids)
    for actor, events in six.iteritems(events_by_actor):
        if actor.type == Team:
            try:
                user_ids = teams_to_user_ids[actor.id]
            except KeyError:
                pass  # TODO(LB) Not certain what to do if a team has no members
            else:
                for user_id in user_ids:
                    if user_id in user_by_events:
                        user_by_events[user_id].update(events)
                    else:
                        user_by_events[user_id] = events
        else:
            user_by_events[actor.id] = events
    return user_by_events


def team_actors_to_user_ids(team_actors, user_ids):
    """
    team_actors_to_user_ids(team_actors: List(Actors), user_ids: List(Int)) -> Map[TeamActor: Set(User_ids)]
    """
    team_ids = [actor.id for actor in team_actors]
    members = OrganizationMemberTeam.objects.filter(
        team_id__in=team_ids,
        is_active=True,
        organizationmember__user_id__in=user_ids,
    ).select_related('organizationmember')

    team_members = {}
    for member in members:
        user_id = member.organizationmember.user_id
        if member.team_id in team_members:
            team_members[member.team_id].add(user_id)
        else:
            team_members[member.team_id] = set([user_id])

    return team_members


def team_to_user_ids(team_id):
    """
    Defunct first attempt but O(n) Queries. Switching to team_actors_to_user_id
    team_to_user_ids(team_id:Int) -> List(User_ids)
    """
    return User.objects.filter(
        is_active=True,
        sentry_orgmember_set__organizationmemberteam__team_id=team_id,
    ).values_list('id', flat=True)
