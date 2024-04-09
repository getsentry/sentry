from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, control_silo_only_model, region_silo_only_model
from sentry.db.models.base import DefaultFieldsModel, sane_repr
from sentry.db.models.fields.uuid import UUIDField


class BaseImportChunk(DefaultFieldsModel):
    """
    Base class representing the map of import pks to final, post-import database pks.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Every import has a UUID assigned to it. If the import was triggered by a relocation, this UUID
    # simply inherits from the `Relocation` model, and can be used to connect back to it. If it is
    # not done via the `Relocation` pathway (that is, someone triggered it using a `sentry import`
    # command via the CLI), it is randomly generated, but shared between all chunks of the same
    # import.
    import_uuid = UUIDField(db_index=True)

    # The name of model that was imported.
    model = models.CharField(db_index=True, max_length=64)

    # The minimum ordinal (inclusive), relative to the source JSON, imported by this chunk.
    min_ordinal = BoundedBigIntegerField()

    # The maximum ordinal (inclusive), relative to the source JSON, imported by this chunk.
    max_ordinal = BoundedBigIntegerField()

    # The minimum (inclusive) original pks from the source blob seen by this chunk.
    min_source_pk = BoundedBigIntegerField()

    # The maximum (inclusive) original pks from the source blob seen by this chunk.
    max_source_pk = BoundedBigIntegerField()

    # The minimum assigned pk (inclusive) imported by this chunk. Nullable because it is possible
    # that no insertions were performed, with all writes being merges or overwrites instead.
    min_inserted_pk = BoundedBigIntegerField(null=True)

    # The maximum assigned pk (inclusive) imported by this chunk. Nullable because it is possible
    # that no insertions were performed, with all writes being merges or overwrites instead.
    max_inserted_pk = BoundedBigIntegerField(null=True)

    # A JSON object map from original pks in the source blob to the pks they were assigned when
    # being inserted into the actual database.
    inserted_map = models.JSONField(default=dict)

    # A JSON object map from original pks in the source blob to the pks they were "merged" with (ie,
    # existing database data that was kept in their stead).
    existing_map = models.JSONField(default=dict)

    # A JSON object map from original pks in the source blob to the pks they "overwrote" (ie, the data from the model was imported into an existing model, and that model's pk was retained).
    overwrite_map = models.JSONField(default=dict)

    # If the inserted model has a "slug" field, or some other similar globally unique string
    # identifier, save it in a map from original pks in the source blob to that "slug" value.
    inserted_identifiers = models.JSONField(default=dict)

    __repr__ = sane_repr("import_uuid", "model", "min_ordinal", "max_ordinal")

    class Meta:
        abstract = True


@region_silo_only_model
class RegionImportChunk(BaseImportChunk):
    """
    Records the pk mapping for the successful import of instances of a model that lives in the
    region silo.
    """

    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionimportchunk"
        unique_together = (("import_uuid", "model", "min_ordinal"),)


@control_silo_only_model
class ControlImportChunk(BaseImportChunk):
    """
    Records the pk mapping for the successful import of instances of a model that lives in the
    control silo.
    """

    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlimportchunk"
        unique_together = (("import_uuid", "model", "min_ordinal"),)


@region_silo_only_model
class ControlImportChunkReplica(BaseImportChunk):
    """
    A duplicate of a `ControlImportChunk` saved on the control silo. Unlike other `*Replica` models,
    this replica is NOT generated via outbox synchronization; rather, it is the responsibility of
    the import algorithm to create this duplicate as soon as the RPC call to the control silo
    returns.

    The purpose of this model is to ensure that the `sentry.backup._import()` method, which always
    executes from the region silo and is responsible for orchestrating the entire import, has an
    accurate view of the current import state. For models housed in the region silo, this is simple:
    we just atomically write a `RegionImportChunk` for the models being imported in the local atomic
    transaction. For models housed in the control silo, things get more complex: we must make an RPC
    call and, when writing the models atomically in that silo, create a `ControlImportChunk`. But
    the `ControlImportChunk` only lives in the control silo, creating the possibility of potentially
    racy retrieval calls if the `_import()` orchestrator tries to access it directly.

    To resolve this, as soon as the RPC call returns, we have the orchestrator make its own,
    region-silo housed copy of the `ControlImportChunk`, called `ControlImportChunkReplica`. Thus,
    when importing a control model, we have 3 scenarios:

      1. The model's import failed: no `ControlImportChunk` or `ControlImportChunkReplica` was
         created. The orchestrator may freely retry if it so chooses.
      2. The model's import succeeded, and the RPC returned successfully: both `ControlImportChunk`
         and `ControlImportChunkReplica` were created as identical copies of one another. The
         orchestrator can now use its locally replicated copy, avoiding further network calls.
      3. The model's import succeeded in the control silo, but the RPC did not return successfully
         (the response got lost due to a network error, an exception was thrown after the database
         write occurred, etc): we only have a `ControlImportChunk` in the control silo, but no
         `ControlImportChunkReplica`. When the orchestrator retries what it perceives to be this
         failed model import, the control-side implementation will detect that a
         `ControlImportChunk` for it already exists, and will simply return successfully without
         doing any further work.
    """

    __relocation_scope__ = RelocationScope.Excluded

    class Meta:
        app_label = "sentry"
        db_table = "sentry_controlimportchunkreplica"
        unique_together = (("import_uuid", "model", "min_ordinal"),)
