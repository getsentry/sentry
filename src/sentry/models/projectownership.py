from __future__ import absolute_import

from jsonfield import JSONField

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey
from sentry.ownership.grammar import load_schema
import six


class ProjectOwnership(Model):
    __core__ = True

    project = FlexibleForeignKey('sentry.Project', unique=True)
    raw = models.TextField(null=True)
    schema = JSONField(null=True)
    fallthrough = models.BooleanField(default=True)
    date_created = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    # An object to indicate ownership is implicitly everyone
    Everyone = object()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectownership'

    __repr__ = sane_repr('project_id', 'is_active')

    @classmethod
    def get_actors(cls, project_id, events):
        """
        For a given project_id, and a list of events,
        returns a dictionary of event to list of resolved actors
        and the rule matcher (if applicable).

        If Everyone is returned, this means we implicitly are
        falling through our rules and everyone is responsible.

        If an empty list is returned, this means there are explicitly
        no owners.
        """
        try:
            ownership = cls.objects.get(project_id=project_id)
        except cls.DoesNotExist:
            ownership = cls(project_id=project_id)

        event_actors = {}
        if ownership.schema is not None:
            event_rules = build_event_rules(ownership, events)
            for event, rules in six.iteritems(event_rules):
                user_owners = []
                team_owners = []
                for rule in rules:
                    # separate users and teams
                    for owner in rule.owners:
                        if owner.type == 'team':
                            team_owners.append(owner)
                        if owner.type == 'user':
                            user_owners.append(owner)
                    user_actors = resolve_user_actors(
                        user_owners, project_id) if user_owners else []
                    team_actors = resolve_team_actors(
                        team_owners, project_id) if team_owners else []
                    event_actors[event] = (set(user_actors + team_actors), rule.matcher)

        if not event_actors:
            actors = cls.Everyone if ownership.fallthrough else {}
            return actors

        return event_actors

    @classmethod
    def get_user_ids_to_events(cls, project_id, events):
        try:
            ownership = cls.objects.get(project_id=project_id)
        except cls.DoesNotExist:
            ownership = cls(project_id=project_id)

        user_id_to_events = {}
        if ownership.schema is not None:
            event_rules = build_event_rules(ownership, events)
            user_id_to_events = build_user_id_to_event_map(event_rules, project_id)

        if not user_id_to_events:
            actors = cls.Everyone if ownership.fallthrough else {}
            return actors, None

        return user_id_to_events, event_rules


def teams_to_user_ids(team_actors):
    """
    team_actors is a list

    returns team_actor -> set(users)
    """
    from sentry.models import User
    # Resolve Teams to User ids
    resolved_teams = {}
    for team in set(team_actors):
        users = User.objects.filter(
            is_active=True,
            sentry_orgmember_set__organizationmemberteam__team_id=team.id,
        ).values_list('id', flat=True)
        resolved_teams[team] = set(users)

    return resolved_teams


def build_user_id_to_event_map(event_rules, project_id):
    user_id_to_events = {}

    # Build owner -> events mapping
    user_owners = {}
    team_owners = {}
    for event, rules in six.iteritems(event_rules):
        for rule in rules:
            for owner in rule.owners:
                if owner.type == 'team':
                    owners = team_owners
                else:
                    owners = user_owners
                if owner in owners:
                    owners[owner].append(event)
                else:
                    owners[owner] = [event]

    # resolve user_owners to actors
    if user_owners:
        user_actors_to_events = resolve_user_actors_map(user_owners, project_id)
    else:
        user_actors_to_events = {}

    # resolve team_owners to actors
    if team_owners:
        team_actors_to_events = resolve_team_actors_map(team_owners, project_id)
    else:
        team_actors_to_events = {}

    # add user_ids to result dictionary
    for user_actor, events in six.iteritems(user_actors_to_events):
        user_id_to_events[user_actor.id] = events
    # create a mapping between team_actor and user_ids
    team_actors_to_user_ids = teams_to_user_ids(six.iterkeys(team_actors_to_events))
    # add the user_ids of team_actors to the result dictionary
    for team_actor, events in six.iteritems(team_actors_to_events):
        for user_id in team_actors_to_user_ids[team_actor]:
            try:
                user_id_to_events[user_id] += events
            except KeyError:
                user_id_to_events[user_id] = events

    # remove duplicate events
    for user_id, events in six.iteritems(user_id_to_events):
        user_id_to_events[user_id] = set(events)

    return user_id_to_events


def resolve_team_actors_map(team_owners, project_id):
    from sentry.api.fields.actor import Actor
    from sentry.models import Team

    teams = Team.objects.filter(
        projectteam__project_id=project_id,
    ).values('id', 'slug')

    teams_dict = {}
    for team in teams:
        teams_dict[team['slug']] = team['id']

    actors = {}
    for team, events in six.iteritems(team_owners):
        team_id = teams_dict[team.identifier]
        actors[Actor(team_id, Team)] = events
    return actors


def resolve_user_actors_map(user_owners, project_id):
    """
   user_owners is a dict owners->events

    returns useractors -> list of events
    """
    from sentry.api.fields.actor import Actor
    from sentry.models import User

    users = User.objects.filter(
        is_active=True,
        sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
    ).values('id', 'email')

    users_dict = {}
    for user in users:
        users_dict[user['email']] = user['id']

    actors = {}
    for user, events in six.iteritems(user_owners):
        user_id = users_dict[user.identifier]
        actors[Actor(user_id, User)] = events
    return actors


class UnknownActor(Exception):
    pass


def resolve_actor(owner, project_id):
    """ Convert an Owner object into an Actor """
    from sentry.api.fields.actor import Actor
    from sentry.models import User, Team

    if owner.type == 'user':
        try:
            user_id = User.objects.filter(
                email__iexact=owner.identifier,
                is_active=True,
                sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
            ).values_list('id', flat=True)[0]
        except IndexError:
            raise UnknownActor

        return Actor(user_id, User)

    if owner.type == 'team':
        try:
            team_id = Team.objects.filter(
                projectteam__project_id=project_id,
                slug=owner.identifier,
            ).values_list('id', flat=True)[0]
        except IndexError:
            raise UnknownActor

        return Actor(team_id, Team)

    raise TypeError('Unknown actor type: %r' % owner.type)


def build_event_rules(ownership, events):
    event_rules = {}
    if ownership.schema is not None:
        rules = load_schema(ownership.schema)
    else:
        return ProjectOwnership.Everyone
    for event in events:
        event_rules[event] = [rule for rule in rules if rule.test(event.data)]
    return event_rules


def resolve_user_actors(user_owners, project_id):
    from sentry.api.fields.actor import Actor
    from sentry.models import User

    users = User.objects.filter(
        is_active=True,
        sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
    ).values('id', 'email')

    users_dict = {}
    for user in users:
        users_dict[user['email']] = user['id']

    actors = []
    for user in user_owners:
        user_id = users_dict[user.identifier]
        actors.append(Actor(user_id, User))
    return actors


def resolve_team_actors(team_owners, project_id):
    from sentry.api.fields.actor import Actor
    from sentry.models import Team

    teams = Team.objects.filter(
        projectteam__project_id=project_id,
    ).values('id', 'slug')

    teams_dict = {}
    for team in teams:
        teams_dict[team['slug']] = team['id']

    actors = []
    for team in team_owners:
        team_id = teams_dict[team.identifier]
        actors.append(Actor(team_id, Team))
    return actors
