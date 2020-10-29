from __future__ import absolute_import, print_function

import six

from collections import defaultdict, namedtuple
from rest_framework import serializers

from sentry.models import User, Team
from sentry.utils.auth import find_users


class Actor(namedtuple("Actor", "id type")):
    def get_actor_id(self):
        return "%s:%d" % (self.type.__name__.lower(), self.id)

    @classmethod
    def from_actor_identifier(cls, actor_identifier):
        """
        Returns an Actor tuple corresponding to a User or Team associated with
        the given identifier.

        Forms `actor_identifier` can take:
            1231 -> look up User by id
            "1231" -> look up User by id
            "user:1231" -> look up User by id
            "team:1231" -> look up Team by id
            "maiseythedog" -> look up User by username
            "maisey@dogsrule.com" -> look up User by primary email
        """
        # If we have an integer, fall back to assuming it's a User
        if isinstance(actor_identifier, six.integer_types):
            return Actor(actor_identifier, User)

        # If the actor_identifier is a simple integer as a string,
        # we're also a User
        if actor_identifier.isdigit():
            return Actor(int(actor_identifier), User)

        if actor_identifier.startswith("user:"):
            return cls(int(actor_identifier[5:]), User)

        if actor_identifier.startswith("team:"):
            return cls(int(actor_identifier[5:]), Team)

        try:
            return Actor(find_users(actor_identifier)[0].id, User)
        except IndexError:
            raise serializers.ValidationError("Unable to resolve actor identifier")

    def resolve(self):
        return self.type.objects.get(id=self.id)

    @classmethod
    def resolve_many(cls, actors):
        if not actors:
            return []

        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = []
        for type, actors in actors_by_type.items():
            results.extend(list(type.objects.filter(id__in=[a.id for a in actors])))

        return results

    @classmethod
    def resolve_dict(cls, actor_dict):
        actors_by_type = defaultdict(list)
        for actor in actor_dict.values():
            actors_by_type[actor.type].append(actor)

        resolved_actors = {}
        for type, actors in actors_by_type.items():
            resolved_actors[type] = {
                actor.id: actor for actor in type.objects.filter(id__in=[a.id for a in actors])
            }

        return {key: resolved_actors[value.type][value.id] for key, value in actor_dict.items()}


class ActorField(serializers.Field):
    def to_representation(self, value):
        return value.get_actor_id()

    def to_internal_value(self, data):
        if not data:
            return None

        try:
            return Actor.from_actor_identifier(data)
        except Exception:
            raise serializers.ValidationError("Unknown actor input")
