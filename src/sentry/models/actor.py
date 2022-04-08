from collections import defaultdict, namedtuple
from typing import TYPE_CHECKING, Mapping, Optional, Sequence, Type, Union

from django.db import models
from django.db.models.signals import pre_save
from rest_framework import serializers

from sentry.db.models import Model
from sentry.utils.compat import filter

if TYPE_CHECKING:
    from sentry.models import Team, User


ACTOR_TYPES = {"team": 0, "user": 1}


def actor_type_to_class(type: int) -> Type[Union["Team", "User"]]:
    # type will be 0 or 1 and we want to get Team or User
    from sentry.models import Team, User

    ACTOR_TYPE_TO_CLASS = {ACTOR_TYPES["team"]: Team, ACTOR_TYPES["user"]: User}

    return ACTOR_TYPE_TO_CLASS[type]


def actor_type_to_string(type: int) -> Optional[str]:
    # type will be 0 or 1 and we want to get "team" or "user"
    for k, v in ACTOR_TYPES.items():
        if v == type:
            return k
    return None


class Actor(Model):
    __include_in_export__ = True

    type = models.PositiveSmallIntegerField(
        choices=(
            (ACTOR_TYPES["team"], "team"),
            (ACTOR_TYPES["user"], "user"),
        )
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"

    def resolve(self):
        # Returns User/Team model object
        return actor_type_to_class(self.type).objects.get(actor_id=self.id)

    def get_actor_tuple(self):
        # Returns ActorTuple version of the Actor model.
        actor_type = actor_type_to_class(self.type)
        return ActorTuple(self.resolve().id, actor_type)

    def get_actor_identifier(self):
        # Returns a string like "team:1"
        # essentially forwards request to ActorTuple.get_actor_identifier
        return self.get_actor_tuple().get_actor_identifier()


class ActorTuple(namedtuple("Actor", "id type")):
    """
    This is an artifact from before we had the Actor model.
    We want to eventually drop this model and merge functionality with Actor
    This should happen more easily if we move GroupAssignee, GroupOwner, etc. to use the Actor model.
    """

    def get_actor_identifier(self):
        return f"{self.type.__name__.lower()}:{self.id}"

    @classmethod
    def from_actor_identifier(cls, actor_identifier):
        from sentry.models import Team, User
        from sentry.utils.auth import find_users

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
        if isinstance(actor_identifier, int):
            return cls(actor_identifier, User)

        # If the actor_identifier is a simple integer as a string,
        # we're also a User
        if actor_identifier.isdigit():
            return cls(int(actor_identifier), User)

        if actor_identifier.startswith("user:"):
            return cls(int(actor_identifier[5:]), User)

        if actor_identifier.startswith("team:"):
            return cls(int(actor_identifier[5:]), Team)

        try:
            return cls(find_users(actor_identifier)[0].id, User)
        except IndexError:
            raise serializers.ValidationError("Unable to resolve actor identifier")

    def resolve(self):
        return self.type.objects.select_related("actor").get(id=self.id)

    def resolve_to_actor(self):
        return self.resolve().actor

    @classmethod
    def resolve_many(cls, actors: Sequence["ActorTuple"]) -> Sequence[Union["Team", "User"]]:
        """
        Resolve multiple actors at the same time. Returns the result in the same order
        as the input, minus any actors we couldn't resolve.
        :param actors:
        :return:
        """
        if not actors:
            return []

        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = {}
        for type, _actors in actors_by_type.items():
            for instance in type.objects.filter(id__in=[a.id for a in _actors]):
                results[(type, instance.id)] = instance

        return list(filter(None, [results.get((actor.type, actor.id)) for actor in actors]))

    @classmethod
    def resolve_dict(cls, actor_dict: Mapping[int, "Actor"]) -> Mapping[int, Union["Team", "User"]]:
        actors_by_type = defaultdict(list)
        for actor in actor_dict.values():
            actors_by_type[actor.type].append(actor)

        resolved_actors = {}
        for type, actors in actors_by_type.items():
            resolved_actors[type] = {
                actor.id: actor for actor in type.objects.filter(id__in=[a.id for a in actors])
            }

        return {key: resolved_actors[value.type][value.id] for key, value in actor_dict.items()}


def handle_actor_pre_save(instance, **kwargs):
    # we want to create an actor if we don't have one
    if not instance.actor_id:
        instance.actor_id = Actor.objects.create(
            type=ACTOR_TYPES[type(instance).__name__.lower()]
        ).id


pre_save.connect(
    handle_actor_pre_save, sender="sentry.Team", dispatch_uid="handle_actor_pre_save", weak=False
)
pre_save.connect(
    handle_actor_pre_save, sender="sentry.User", dispatch_uid="handle_actor_pre_save", weak=False
)
