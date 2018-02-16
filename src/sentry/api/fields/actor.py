from __future__ import absolute_import, print_function

import six

from collections import defaultdict, namedtuple
from rest_framework import serializers

from sentry.models import User, Team
from sentry.utils.auth import find_users


class Actor(namedtuple('Actor', 'id type')):
    def get_actor_id(self):
        return '%s:%d' % (self.type.__name__.lower(), self.id)

    @classmethod
    def from_actor_id(cls, actor_id):
        # If we have an integer, fall back to assuming it's a User
        if isinstance(actor_id, six.integer_types):
            return Actor(actor_id, User)

        # If the actor_id is a simple integer as a string,
        # we're also a User
        if actor_id.isdigit():
            return Actor(int(actor_id), User)

        if u':' in actor_id:
            type_name, _, id = actor_id.partition(':')
            return cls(int(id), {'user': User, 'team': Team}[type_name])

        try:
            return Actor(find_users(actor_id)[0].id, User)
        except IndexError:
            raise serializers.ValidationError('Unable to resolve actor id')

    def resolve(self):
        return self.type.objects.get(id=self.id)

    @classmethod
    def resolve_many(cls, actors):
        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = []
        for type, actors in actors_by_type.items():
            results.extend(list(type.objects.filter(
                id__in=[a.id for a in actors]
            )))

        return results


class ActorField(serializers.WritableField):
    def to_native(self, obj):
        return obj.get_actor_id()

    def from_native(self, data):
        if not data:
            return None

        try:
            return Actor.from_actor_id(data)
        except Exception:
            raise serializers.ValidationError('Unknown actor input')
