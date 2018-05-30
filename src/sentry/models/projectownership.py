from __future__ import absolute_import

import operator

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
    def get_owners(cls, project_id, data):
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

        rules = []
        if ownership.schema is not None:
            for rule in load_schema(ownership.schema):
                if rule.test(data):
                    rules.append(rule)

        if not rules:
            return cls.Everyone if ownership.fallthrough else [], None

        owners = {o for rule in rules for o in rule.owners}

        return filter(None, resolve_actors(owners, project_id).values()), rules


def resolve_actors(owners, project_id):
    """ Convert a list of Owner objects into a dictionary
    of {Owner: Actor} pairs. Actors not identified are returned
    as None. """
    from sentry.api.fields.actor import Actor
    from sentry.ownership.grammar import Owner
    from sentry.models import User, Team

    if not owners:
        return {}

    users, teams = [], []

    owners_to_actors = {o: None for o in owners}

    for owner in owners:
        if owner.type == 'user':
            users.append(owner)
        elif owner.type == 'team':
            teams.append(owner)

    actors = []
    if users:
        actors.extend([
            ('user', email, Actor(u_id, User))
            for u_id, email in User.objects.filter(
                reduce(
                    operator.or_,
                    [Q(email__iexact=o.identifier) for o in users]
                ),
                is_active=True,
                sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
            ).values_list('id', 'email')
        ])

    if teams:
        actors.extend([
            ('team', slug, Actor(t_id, Team))
            for t_id, slug in Team.objects.filter(
                slug__in=[o.identifier for o in teams],
                projectteam__project_id=project_id,
            ).values_list('id', 'slug')
        ])

    for type, identifier, actor in actors:
        owners_to_actors[Owner(type, identifier)] = actor

    return owners_to_actors
