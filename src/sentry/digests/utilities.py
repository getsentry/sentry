from __future__ import absolute_import

import six

from collections import Counter, OrderedDict
from sentry.models import ProjectOwnership, Team, User


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
    if not ProjectOwnership.objects.filter(project_id=project_id).exists():
        return ProjectOwnership.Everyone
    records = get_records_from_digests(digest)
    events = [record.value.event for record in records]

    events_by_actor = build_events_by_actor(project_id, events)
    events_by_users = convert_actors_to_user_set(events_by_actor)

    for user_id in user_ids:
        yield user_id, build_custom_digest(digest, user_id, events_by_users)


def get_records_from_digests(digest):
    """
    get_records_from_digests(digest: Digest) -> Set(Records)
    """
    records = set()
    for rule, rule_groups in six.iteritems(digest):
        for group, group_records in six.iteritems(rule_groups):
            records.update(group_records)
    return records


def build_custom_digest(original_digest, user_id, events_by_users):
    """
    build_custom_digest(original_digest: Digest, user_id: Int, events_by_users: Map[User_Id:Set(Events)]) -> Digest
    """
    user_digest = OrderedDict()
    for rule, rule_groups in six.iteritems(original_digest):
        user_rule_groups = OrderedDict()
        for group, group_records in six.iteritems(rule_groups):
            user_group_records = [
                record for record in group_records
                if user_id in events_by_users[record.value.event]
            ]
            if user_group_records:
                user_rule_groups[group] = user_group_records

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
        actors = ProjectOwnership.get_owners(project_id, event)
        for actor in actors:
            if actor in events_by_actor:
                events_by_actor[actor].update(event)
            else:
                events_by_actor[actor] = set(event)
    return events_by_actor


def convert_actors_to_user_set(events_by_actor):
    """
    convert_actors_to_user_set(events_by_actor: Map[Actor:Set(Events)]) -> Map[User_Id:Set(Events)]
    """
    user_by_events = {}
    for actor, events in six.iteritems(events_by_actor):
        if actor.type == Team:
            user_ids = team_to_user_ids(actor.id)
            for user_id in user_ids:
                if user_id in user_by_events:
                    user_by_events[user_id].update(events)
                else:
                    user_by_events[user_id] = events
        else:
            user_by_events[actor.id] = events
    return user_by_events


def team_to_user_ids(team_id):
    """
    team_to_user_ids(team_id:Int) -> List(User_ids)
    """
    return User.objects.filter(
        is_active=True,
        sentry_orgmember_set__organizationmemberteam__team_id=team_id,
    ).values_list('id', flat=True)
