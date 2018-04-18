from __future__ import absolute_import

from jsonfield import JSONField

from django.db import models
from django.db.models import Q
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey
from sentry.ownership.grammar import load_schema


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
        For a given project_id, and event data blob.

        If Everyone is returned, this means we implicitly are
        falling through our rules and everyone is responsible.

        If an empty list is returned, this means there are explicitly
        no owners.
        """
        try:
            ownership = cls.objects.get(project_id=project_id)
        except cls.DoesNotExist:
            ownership = cls(
                project_id=project_id,
            )

        owners_by_event = {}
        owners = set()
        if ownership.schema is not None:
            rules = load_schema(ownership.schema)
            for event in events:
                for rule in rules:
                    if rule.test(event.data):
                        owners_by_event[event] = (rule.owners, rule.matcher)
                        owners.update(rule.owners)
                        break

            if len(owners) != 0:
                actors_by_identifier = resolve_actors(project_id, owners)
                actors_by_event = {}
                for event in events:
                    owners_list = owners_by_event[event][0]
                    matcher = owners_by_event[event][1]
                    event_actors = [actors_by_identifier[owner.identifier] for owner in owners_list]
                    actors_by_event[event] = (event_actors, matcher)
                return actors_by_event

        owners = cls.Everyone if ownership.fallthrough else []
        return owners, None  # TODO(LB): Not exactly consistent with other return value.


class UnknownActor(Exception):
    pass


def resolve_actors(project_id, owners):
    """ Convert an Owner object into an Actor """

    user_owners, team_owners = separate_owners_by_type(owners)
    user_actors = resolve_user_actors(project_id, user_owners)
    team_actors = resolve_team_actors(project_id, team_owners)

    return dict(user_actors.items() + team_actors.items())


def separate_owners_by_type(owners):
    """
    separate_owners_by_type(owners: List(Owners)) -> List(Owners), List(Owners)
    """
    user_owners = []
    team_owners = []
    for owner in owners:
        if owner.type == 'user':
            user_owners.append(owner)
        elif owner.type == 'team':
            team_owners.append(owner)
        else:
            # TODO(LB): I don't totally agree with raising an error here,
            # but preserving current behavior
            raise UnknownActor('Unknown actor type: %r' % owner.type)
    return user_owners, team_owners


def resolve_user_actors(project_id, user_owners):
    """
    resolve_user_actors(project_id: Int, user_owners: List(Owners)) -> List(Actors)
    """
    from sentry.api.fields.actor import Actor
    from sentry.models import User

    emails = [user_owner.identifier for user_owner in user_owners]
    users = User.objects.filter(
        reduce(lambda a, b: a | b, map(lambda x: Q(email__iexact=x), emails)),
        is_active=True,
        sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
    ).values_list('email', 'id')

    user_actors_by_email = {email: Actor(user_id, User) for (email, user_id) in users}
    # for user_info in user_infos:
    #    user_actors_by_email[user_info[0]] = Actor(user_info[1], User)
    return user_actors_by_email


def resolve_team_actors(project_id, team_owners):
    """
    resolve_team_actors(project_id: Int, team_owners: List(Owners)) -> List(Actors)
    """
    from sentry.api.fields.actor import Actor
    from sentry.models import Team

    teams = Team.objects.filter(
        projectteam__project_id=project_id,
        slug__in=[owner.identifier for owner in team_owners],
    ).values_list('slug', 'id')

    team_actors_by_slug = {slug: Actor(team_id, Team) for (slug, team_id) in teams}
    # for team_info in team_infos:
    #    team_actors_by_slug[team_info[0]] = Actor(team_info[1], Team)
    return team_actors_by_slug
