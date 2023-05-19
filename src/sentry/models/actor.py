from collections import defaultdict, namedtuple
from typing import TYPE_CHECKING, List, Optional, Sequence, Type, Union, cast

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models.signals import post_save
from rest_framework import serializers

from sentry.db.models import Model, region_silo_only_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service

if TYPE_CHECKING:
    from sentry.models import Team, User

ACTOR_TYPES = {"team": 0, "user": 1}


def actor_type_to_class(type: int) -> Type[Union["Team", "RpcUser"]]:
    # type will be 0 or 1 and we want to get Team or User
    from sentry.models import Team, User

    ACTOR_TYPE_TO_CLASS = {ACTOR_TYPES["team"]: Team, ACTOR_TYPES["user"]: User}

    return ACTOR_TYPE_TO_CLASS[type]


def fetch_actor_by_actor_id(cls, actor_id: int) -> Union["Team", "RpcUser"]:
    results = fetch_actors_by_actor_ids(cls, [actor_id])
    if len(results) == 0:
        raise cls.DoesNotExist()
    return results[0]


def fetch_actors_by_actor_ids(cls, actor_ids: List[int]) -> Union[List["Team"], List["RpcUser"]]:
    from sentry.models import Team, User

    if cls is User:
        user_ids = Actor.objects.filter(type=ACTOR_TYPES["user"], id__in=actor_ids).values_list(
            "user_id", flat=True
        )
        return user_service.get_many(filter={"user_ids": user_ids})
    if cls is Team:
        return Team.objects.filter(actor_id__in=actor_ids).all()

    raise ValueError(f"Cls {cls} is not a valid actor type.")


def fetch_actor_by_id(cls, id: int) -> Union["Team", "RpcUser"]:
    from sentry.models import Team, User

    if cls is Team:
        return Team.objects.get(id=id)

    if cls is User:
        user = user_service.get_user(id)
        if user is None:
            raise User.DoesNotExist()
        return user


def actor_type_to_string(type: int) -> Optional[str]:
    # type will be 0 or 1 and we want to get "team" or "user"
    for k, v in ACTOR_TYPES.items():
        if v == type:
            return k
    return None


@region_silo_only_model
class Actor(Model):
    __include_in_export__ = True

    type = models.PositiveSmallIntegerField(
        choices=(
            (ACTOR_TYPES["team"], "team"),
            (ACTOR_TYPES["user"], "user"),
        )
    )
    user_id = HybridCloudForeignKey(
        settings.AUTH_USER_MODEL, on_delete="CASCADE", db_index=True, unique=True, null=True
    )
    team = FlexibleForeignKey(
        "sentry.Team",
        related_name="actor_from_team",
        db_constraint=True,
        db_index=True,
        unique=True,
        null=True,
        on_delete=models.CASCADE,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_actor"

    def resolve(self) -> Union["Team", "RpcUser"]:
        # Returns User/Team model object
        return fetch_actor_by_actor_id(actor_type_to_class(self.type), self.id)

    def get_actor_tuple(self) -> "ActorTuple":
        # Returns ActorTuple version of the Actor model.
        actor_type = actor_type_to_class(self.type)
        return ActorTuple(self.resolve().id, actor_type)

    def get_actor_identifier(self):
        # Returns a string like "team:1"
        # essentially forwards request to ActorTuple.get_actor_identifier
        return self.get_actor_tuple().get_actor_identifier()


def get_actor_id_for_user(user: Union["User", RpcUser]) -> int:
    return cast(int, get_actor_for_user(user).id)


def get_actor_for_user(user: Union[int, "User", RpcUser]) -> "Actor":
    if isinstance(user, int):
        user_id = user
    else:
        user_id = user.id
    try:
        with transaction.atomic():
            actor, created = Actor.objects.get_or_create(type=ACTOR_TYPES["user"], user_id=user_id)
            if created:
                # TODO(actorid) This RPC call should be removed once all reads to
                # User.actor_id have been removed.
                user_service.update_user(user_id=user_id, attrs={"actor_id": actor.id})
    except IntegrityError as err:
        # Likely a race condition. Long term these need to be eliminated.
        sentry_sdk.capture_exception(err)
        actor = Actor.objects.filter(type=ACTOR_TYPES["user"], user_id=user_id).first()
    return actor


class ActorTuple(namedtuple("Actor", "id type")):
    """
    This is an artifact from before we had the Actor model.
    We want to eventually drop this model and merge functionality with Actor
    This should happen more easily if we move GroupAssignee, GroupOwner, etc. to use the Actor model.
    """

    def get_actor_identifier(self):
        return f"{self.type.__name__.lower()}:{self.id}"

    @classmethod
    def from_actor_identifier(cls, actor_identifier: Union[int, str, None]) -> "ActorTuple":
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

        if actor_identifier is None:
            return None

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
        except IndexError as e:
            raise serializers.ValidationError(f"Unable to resolve actor identifier: {e}")

    def resolve(self) -> Union["Team", "RpcUser"]:
        return fetch_actor_by_id(self.type, self.id)

    def resolve_to_actor(self) -> Actor:
        obj = self.resolve()
        # TODO(actorid) Remove this once user no longer has actor_id.
        if obj.actor_id is None or isinstance(obj, RpcUser):
            return get_actor_for_user(obj)
        # Team case
        return Actor.objects.get(id=obj.actor_id)

    @classmethod
    def resolve_many(cls, actors: Sequence["ActorTuple"]) -> Sequence[Union["Team", "RpcUser"]]:
        """
        Resolve multiple actors at the same time. Returns the result in the same order
        as the input, minus any actors we couldn't resolve.
        :param actors:
        :return:
        """
        from sentry.models import User

        if not actors:
            return []

        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = {}
        for type, _actors in actors_by_type.items():
            if type == User:
                for instance in user_service.get_many(filter={"user_ids": [a.id for a in _actors]}):
                    results[(type, instance.id)] = instance
            else:
                for instance in type.objects.filter(id__in=[a.id for a in _actors]):
                    results[(type, instance.id)] = instance

        return list(filter(None, [results.get((actor.type, actor.id)) for actor in actors]))


def handle_team_post_save(instance, **kwargs):
    # we want to create an actor if we don't have one
    if not instance.actor_id:
        instance.actor_id = Actor.objects.create(
            type=ACTOR_TYPES[type(instance).__name__.lower()],
            team_id=instance.id,
        ).id
        instance.save()


post_save.connect(
    handle_team_post_save, sender="sentry.Team", dispatch_uid="handle_team_post_save", weak=False
)
