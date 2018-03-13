from __future__ import absolute_import

from jsonfield import JSONField

from django.db import models
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

        if ownership.schema is not None:
            for rule in load_schema(ownership.schema):
                if rule.test(data):
                    # This is O(n) to resolve, but should be fine for now
                    # since we don't even explain that you can use multiple
                    # let alone a number that would be potentially abusive.
                    owners = []
                    for o in rule.owners:
                        try:
                            owners.append(resolve_actor(o, project_id))
                        except UnknownActor:
                            continue
                    return owners, rule.matcher

        owners = cls.Everyone if ownership.fallthrough else []
        return owners, None


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
