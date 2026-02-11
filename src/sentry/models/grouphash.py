from __future__ import annotations

from typing import TYPE_CHECKING, Any, ClassVar

from django.core.cache import cache
from django.db import models
from django.db.models.signals import pre_delete, pre_save
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
)
from sentry.db.models.base import sane_repr
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.grouping.ingest.caching import (
    get_grouphash_cache_version,
    get_grouphash_object_cache_key,
    invalidate_grouphash_cache_on_save,
    invalidate_grouphash_caches_on_delete,
)
from sentry.types.grouphash_metadata import has_fingerprint_data
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

if TYPE_CHECKING:
    from sentry.models.grouphashmetadata import GroupHashMetadata


# Use a custom queryset class so we can invalidate the relevant cache entries when data is updated.
# Note that we don't need to write custom methods for saving or deleting because those send built-in
# Django signals we can listen for (see end of file). We also don't have to override the model's
# `update` method because our base model class already does that, with a method that calls the
# queryset's `update`.
class GroupHashQuerySet(BaseQuerySet):
    def update(self, **kwargs: Any) -> int:
        if not options.get("grouping.use_ingest_grouphash_caching"):
            return super().update(**kwargs)

        cache_keys = [
            get_grouphash_object_cache_key(hash_value, project_id)
            for hash_value, project_id in (
                self.update_with_returning(  # This is where the actual update occurs
                    ["hash", "project_id"], **kwargs
                )
            )
        ]

        # TODO: We can remove the version once we've settled on a good retention period
        cache.delete_many(cache_keys, version=get_grouphash_cache_version("object"))

        return len(cache_keys)


class GroupHashModelManager(BaseManager["GroupHash"]):
    def get_queryset(self) -> GroupHashQuerySet:
        return GroupHashQuerySet(self.model, using=self._db)


@region_silo_model
class GroupHash(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class State:
        UNLOCKED: None = None
        LOCKED_IN_MIGRATION = 1

    project = FlexibleForeignKey("sentry.Project", null=True)
    hash = models.CharField(max_length=32)
    group = FlexibleForeignKey("sentry.Group", null=True)

    # not-null => the event should be discarded
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)
    state = BoundedPositiveIntegerField(
        choices=[(State.LOCKED_IN_MIGRATION, _("Locked (Migration in Progress)"))], null=True
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    # Custom manager in order to override the queryset `update` method, so that we can invalidate
    # the grouphash cache used during ingest when `GroupHash.objects.update` is called (such as when
    # we merge groups).
    objects: ClassVar[GroupHashModelManager] = GroupHashModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouphash"
        unique_together = (("project", "hash"),)

    @property
    def metadata(self) -> GroupHashMetadata | None:
        try:
            return self._metadata
        except AttributeError:
            return None

    __repr__ = sane_repr("group_id", "hash", "metadata")
    __str__ = __repr__

    def get_associated_fingerprint(self) -> list[str] | None:
        """
        Pull a resolved fingerprint value from the grouphash's metadata, if possible.

        This only returns results for hashes which come from either hybrid or custom fingerprints.
        Even then, the hash may come from a time before we were storing such data, in which case
        this returns None.
        """
        if (
            not self.metadata
            or not self.metadata.hashing_metadata
            or not has_fingerprint_data(self.metadata.hashing_metadata)
        ):
            return None

        try:
            return json.loads(self.metadata.hashing_metadata["fingerprint"])

        # Fingerprints used to be stored by stringifying them rather than jsonifying them, and the
        # stringified ones can't be parsed and will cause this error
        except JSONDecodeError:
            return None


# Calling `save` on the model uses the built-in method, which sends save signals. You can't call
# `save` on queryset. This handler deletes the grouphash from the `GroupHash` object cache.
pre_save.connect(invalidate_grouphash_cache_on_save, sender=GroupHash, weak=False)

# Calling `delete` on the model or the queryset calls `Collector.delete` which sends delete signals
# if you're acting on multiple rows and/or the model has dependencies (but not if not). Fortunately,
# `GroupHashMetadata` depends on `GroupHash` so the latter doesn't qualify for fast deletes and the
# signals are sent. This handler deletes the grouphash from both the `GroupHash` object cache and
# the grouphash existence boolean cache.
pre_delete.connect(invalidate_grouphash_caches_on_delete, sender=GroupHash, weak=False)
