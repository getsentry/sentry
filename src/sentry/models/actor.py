from __future__ import annotations

from typing import TYPE_CHECKING, overload

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, models, router, transaction
from django.db.models.signals import post_save
from django.forms import model_to_dict

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import Model, region_silo_only_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox, outbox_context
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.utils.actor import ActorTuple

if TYPE_CHECKING:
    from sentry.models.team import Team
    from sentry.models.user import User

ACTOR_TYPES = {
    "team": 0,
    "user": 1,
}


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


def fetch_actor_by_actor_id(cls, actor_id: int) -> Team | RpcUser:
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

    def resolve(self) -> Team | RpcUser:
        # Returns User/Team model object
        return fetch_actor_by_actor_id(actor_type_to_class(self.type), self.id)

    def get_actor_tuple(self) -> ActorTuple:
        # Returns ActorTuple version of the Actor model.
        actor_type = actor_type_to_class(self.type)

        if self.type == ACTOR_TYPES["user"]:
            return ActorTuple(self.user_id, actor_type)
        if self.type == ACTOR_TYPES["team"]:
            return ActorTuple(self.team_id, actor_type)

        raise ValueError("Unknown actor type")

    def get_actor_identifier(self):
        # Returns a string like "team:1"
        # essentially forwards request to ActorTuple.get_actor_identifier
        return self.get_actor_tuple().identifier

    @classmethod
    def query_for_relocation_export(cls, q: models.Q, pk_map: PrimaryKeyMap) -> models.Q:
        # Actors that can have both their `user` and `team` value set to null. Exclude such actors # from the export.
        q = super().query_for_relocation_export(q, pk_map)

        return q & ~models.Q(team__isnull=True, user_id__isnull=True)

    # TODO(hybrid-cloud): actor refactor. Remove this method when done.
    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> tuple[int, ImportKind] | None:
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


def get_actor_for_user(user: int | User | RpcUser) -> Actor:
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


def get_actor_for_team(team: int | Team) -> Actor:
    if isinstance(team, int):
        team_id = team
    else:
        team_id = team.id
    try:
        with transaction.atomic(router.db_for_write(Actor)):
            actor, _ = Actor.objects.get_or_create(type=ACTOR_TYPES["team"], team_id=team_id)
    except IntegrityError as err:
        # Likely a race condition. Long term these need to be eliminated.
        sentry_sdk.capture_exception(err)
        actor = Actor.objects.filter(type=ACTOR_TYPES["team"], team_id=team_id).first()
    return actor


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
