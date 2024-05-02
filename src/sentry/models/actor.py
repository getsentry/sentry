from __future__ import annotations

from django.conf import settings
from django.db import models, router, transaction
from django.forms import model_to_dict

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox, outbox_context

ACTOR_TYPES = {
    "team": 0,
    "user": 1,
}


@region_silo_model
class Actor(Model):
    # Temporary until Actor is removed
    __relocation_scope__ = RelocationScope.Excluded

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
