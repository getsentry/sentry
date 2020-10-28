from __future__ import absolute_import

import six

from collections import Counter, defaultdict, OrderedDict
from sentry.models import OrganizationMemberTeam, ProjectOwnership, Team, User
from sentry.api.fields.actor import Actor


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


def get_personalized_digests(target_type, project_id, digest, user_ids):
    """
    get_personalized_digests(project_id: Int, digest: Digest, user_ids: Set[Int]) -> Iterator[user_id: Int, digest: Digest]
    """
    from sentry.mail.adapter import ActionTargetType

    # TODO(LB): I Know this is inefficient.
    # In the case that ProjectOwnership does exist, I do the same query twice.
    # Once with this statement and again with the call to ProjectOwnership.get_actors()
    # Will follow up with another PR to reduce the number of queries.
    if (
        target_type == ActionTargetType.ISSUE_OWNERS
        and ProjectOwnership.objects.filter(project_id=project_id).exists()
    ):
        events = get_event_from_groups_in_digest(digest)
        events_by_actor = build_events_by_actor(project_id, events, user_ids)
        events_by_user = convert_actors_to_users(events_by_actor, user_ids)
        for user_id, user_events in six.iteritems(events_by_user):
            yield user_id, build_custom_digest(digest, user_events)
    else:
        for user_id in user_ids:
            yield user_id, digest


def get_event_from_groups_in_digest(digest):
    """
    get_event_from_groups_in_digest(digest: Digest)

    Gets the first event from each group in the digest
    """
    events = []
    for rule_groups in six.itervalues(digest):
        for group_records in six.itervalues(rule_groups):
            events.append(group_records[0].value.event)
    return set(events)


def build_custom_digest(original_digest, events):
    """
    build_custom_digest(original_digest: Digest, events: Set[Events]) -> Digest
    """
    user_digest = OrderedDict()
    for rule, rule_groups in six.iteritems(original_digest):
        user_rule_groups = OrderedDict()
        for group, group_records in six.iteritems(rule_groups):
            user_group_records = [
                record for record in group_records if record.value.event in events
            ]
            if user_group_records:
                user_rule_groups[group] = user_group_records
        if user_rule_groups:
            user_digest[rule] = user_rule_groups
    return user_digest


def build_events_by_actor(project_id, events, user_ids):
    """
    build_events_by_actor(project_id: Int, events: Set(Events), user_ids: Set[Int]) -> Map[Actor, Set(Events)]
    """
    events_by_actor = defaultdict(set)
    for event in events:
        # TODO(LB): I Know this is inefficient.
        # ProjectOwnership.get_owners is O(n) queries and I'm doing that O(len(events)) times
        # I will create a follow-up PR to address this method's efficiency problem
        # Just wanted to make as few changes as possible for now.
        actors, __ = ProjectOwnership.get_owners(project_id, event.data)
        if actors == ProjectOwnership.Everyone:
            actors = [Actor(user_id, User) for user_id in user_ids]
        for actor in actors:
            events_by_actor[actor].add(event)
    return events_by_actor


def convert_actors_to_users(events_by_actor, user_ids):
    """
    convert_actors_to_user_set(events_by_actor: Map[Actor, Set(Events)], user_ids: List(Int)) -> Map[user_id: Int, Set(Events)]
    """
    events_by_user = defaultdict(set)
    team_actors = [actor for actor in six.iterkeys(events_by_actor) if actor.type == Team]
    teams_to_user_ids = team_actors_to_user_ids(team_actors, user_ids)
    for actor, events in six.iteritems(events_by_actor):
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


def team_actors_to_user_ids(team_actors, user_ids):
    """
    team_actors_to_user_ids(team_actors: List(Actors), user_ids: List(Int)) -> Map[team_id:Int, user_ids:Set(Int)]

    Will not include a team in the result if there are no active members in a team.
    """
    team_ids = [actor.id for actor in team_actors]
    members = OrganizationMemberTeam.objects.filter(
        team_id__in=team_ids, is_active=True, organizationmember__user_id__in=user_ids
    ).select_related("organizationmember")

    team_members = defaultdict(set)
    for member in members:
        user_id = member.organizationmember.user_id
        team_members[member.team_id].add(user_id)

    return team_members
