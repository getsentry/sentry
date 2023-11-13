from __future__ import annotations

from collections import defaultdict, namedtuple
from typing import TYPE_CHECKING, Optional, Sequence, Tuple, Union, overload

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, models, router, transaction
from django.db.models.signals import post_save
from django.forms import model_to_dict
from rest_framework import serializers

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import Model, region_silo_only_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox, outbox_context
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service

if TYPE_CHECKING:
    from sentry.models.team import Team
    from sentry.models.user import User

ACTOR_TYPES = {"team": 0, "user": 1}


def actor_type_to_class(type: int) -> type[Team] | type[User]:
    # `type` will be 0 or 1 and we want to get Team or User
    from sentry.models.team import Team
    from sentry.models.user import User

    if type == ACTOR_TYPES["team"]:
        return Team
    elif type == ACTOR_TYPES["user"]:
        return User
    else:
        raise ValueError(type)


def fetch_actor_by_actor_id(cls, actor_id: int) -> Union[Team, RpcUser]:
    results = fetch_actors_by_actor_ids(cls, [actor_id])
    if len(results) == 0:
        raise cls.DoesNotExist()
    return results[0]


@overload
def fetch_actors_by_actor_ids(cls: type[User], actor_ids: list[int]) -> list[RpcUser]:
    ...


@overload
def fetch_actors_by_actor_ids(cls: type[Team], actor_ids: list[int]) -> list[Team]:
    ...


def fetch_actors_by_actor_ids(
    cls: type[User] | type[Team], actor_ids: list[int]
) -> list[Team] | list[RpcUser]:
    from sentry.models.team import Team
    from sentry.models.user import User

    if cls is User:
        user_ids = Actor.objects.filter(type=ACTOR_TYPES["user"], id__in=actor_ids).values_list(
            "user_id", flat=True
        )
        return user_service.get_many(filter={"user_ids": list(user_ids)})
    elif cls is Team:
        return Team.objects.filter(actor_id__in=actor_ids).all()
    else:
        raise ValueError(f"Cls {cls} is not a valid actor type.")


@overload
def fetch_actor_by_id(cls: type[User], id: int) -> RpcUser:
    ...


@overload
def fetch_actor_by_id(cls: type[Team], id: int) -> Team:
    ...


def fetch_actor_by_id(cls: type[User] | type[Team], id: int) -> Team | RpcUser:
    from sentry.models.team import Team
    from sentry.models.user import User

    if cls is Team:
        return Team.objects.get(id=id)

    elif cls is User:
        user = user_service.get_user(id)
        if user is None:
            raise User.DoesNotExist()
        return user
    else:
        raise ValueError(f"Cls {cls} is not a valid actor type.")


def actor_type_to_string(type: int) -> str | None:
    # `type` will be 0 or 1 and we want to get "team" or "user"
    for k, v in ACTOR_TYPES.items():
        if v == type:
            return k
    return None


@region_silo_only_model
class Actor(Model):
    __relocation_scope__ = RelocationScope.Organization

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

    def outbox_for_update(self) -> RegionOutbox:
        return RegionOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=self.id,
            object_identifier=self.id,
            category=OutboxCategory.ACTOR_UPDATE,
        )

    def delete(self, **kwargs):
        with outbox_context(transaction.atomic(router.db_for_write(Actor))):
            self.outbox_for_update().save()
        return super().delete(**kwargs)

    def resolve(self) -> Union[Team, RpcUser]:
        # Returns User/Team model object
        return fetch_actor_by_actor_id(actor_type_to_class(self.type), self.id)

    def get_actor_tuple(self) -> ActorTuple:
        # Returns ActorTuple version of the Actor model.
        actor_type = actor_type_to_class(self.type)
        return ActorTuple(self.resolve().id, actor_type)

    def get_actor_identifier(self):
        # Returns a string like "team:1"
        # essentially forwards request to ActorTuple.get_actor_identifier
        return self.get_actor_tuple().get_actor_identifier()

    @classmethod
    def query_for_relocation_export(cls, q: models.Q, pk_map: PrimaryKeyMap) -> models.Q:
        # Actors that can have both their `user` and `team` value set to null. Exclude such actors # from the export.
        q = super().query_for_relocation_export(q, pk_map)

        return q & ~models.Q(team__isnull=True, user_id__isnull=True)

    # TODO(hybrid-cloud): actor refactor. Remove this method when done.
    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        if self.team is None:
            return super().write_relocation_import(scope, flags)

        # `Actor` and `Team` have a direct circular dependency between them for the time being due
        # to an ongoing refactor (that is, `Actor` foreign keys directly into `Team`, and `Team`
        # foreign keys directly into `Actor`). If we use `INSERT` database calls naively, they will
        # always fail, because one half of the cycle will always be missing.
        #
        # Because `Team` ends up first in the dependency sorting (see:
        # fixtures/backup/model_dependencies/sorted.json), a viable solution here is to always null
        # out the `actor_id` field of the `Team` when we import it, then rely on that model's
        # `post_save()` hook to fill in the `Actor` model.
        (actor, _) = Actor.objects.get_or_create(team=self.team, defaults=model_to_dict(self))
        if actor:
            self.pk = actor.pk
            self.save()

        return (self.pk, ImportKind.Inserted)


def get_actor_id_for_user(user: Union[User, RpcUser]) -> int:
    return get_actor_for_user(user).id


def get_actor_for_user(user: Union[int, User, RpcUser]) -> Actor:
    if isinstance(user, int):
        user_id = user
    else:
        user_id = user.id
    try:
        with transaction.atomic(router.db_for_write(Actor)):
            actor, _ = Actor.objects.get_or_create(type=ACTOR_TYPES["user"], user_id=user_id)
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

    @overload
    @classmethod
    def from_actor_identifier(cls, actor_identifier: None) -> None:
        ...

    @overload
    @classmethod
    def from_actor_identifier(cls, actor_identifier: int | str) -> ActorTuple:
        ...

    @classmethod
    def from_actor_identifier(cls, actor_identifier: int | str | None) -> ActorTuple | None:
        from sentry.models.team import Team
        from sentry.models.user import User

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
            user = user_service.get_by_username(username=actor_identifier)[0]
            return cls(user.id, User)
        except IndexError as e:
            raise serializers.ValidationError(f"Unable to resolve actor identifier: {e}")

    def resolve(self) -> Union[Team, RpcUser]:
        return fetch_actor_by_id(self.type, self.id)

    def resolve_to_actor(self) -> Actor:
        from sentry.models.user import User

        obj = self.resolve()
        if isinstance(obj, (User, RpcUser)):
            return get_actor_for_user(obj)
        # Team case. Teams have actors generated as a post_save signal
        return Actor.objects.get(id=obj.actor_id)

    @classmethod
    def resolve_many(cls, actors: Sequence[ActorTuple]) -> Sequence[Union[Team, RpcUser]]:
        """
        Resolve multiple actors at the same time. Returns the result in the same order
        as the input, minus any actors we couldn't resolve.
        :param actors:
        :return:
        """
        from sentry.models.user import User

        if not actors:
            return []

        actors_by_type = defaultdict(list)
        for actor in actors:
            actors_by_type[actor.type].append(actor)

        results = {}
        for model_class, _actors in actors_by_type.items():
            if model_class == User:
                for instance in user_service.get_many(filter={"user_ids": [a.id for a in _actors]}):
                    results[(model_class, instance.id)] = instance
            else:
                for instance in model_class.objects.filter(id__in=[a.id for a in _actors]):
                    results[(model_class, instance.id)] = instance

        return list(filter(None, [results.get((actor.type, actor.id)) for actor in actors]))


def handle_team_post_save(instance, **kwargs):
    # we want to create an actor if we don't have one
    if not instance.actor_id:
        instance.actor_id = Actor.objects.create(
            type=ACTOR_TYPES["team"],
            team_id=instance.id,
        ).id
        instance.save()


post_save.connect(
    handle_team_post_save, sender="sentry.Team", dispatch_uid="handle_team_post_save", weak=False
)
