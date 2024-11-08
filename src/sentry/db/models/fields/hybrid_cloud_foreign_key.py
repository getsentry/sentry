"""
A 'foreign key' which is not enforced in the local database, but triggers eventually consistent delete work in the
presence of either RegionTombstone or ControlTombstone model objects through the tasks/deletion/hybrid_cloud.py logic.

Its main purpose is to support foreign key columns in, say, region silos that refer to User or Integration objects (conversely
also columns in the control silo that point to, say, Organization objects) that do not actually exist in the local database,
or even the local network.

Functionally, this field is just a dumb BigIntegerField. While it does support indexes, it does not support any
integrity constraints. This means, for instance, you should not assume that these integer fields reference a valid
existing object, even if the column is non-nullable. If the related object is deleted and processed correctly,
the row may either be deleted or have its column value set to null depending on the chosen cascade behavior and null
constraints set on the column, but does not make any strong consistency guarantees.

Cascade behavior is provided to the application via tasks/deletion/hybrid_cloud.py jobs.  Again, to emphasize, this
process is eventually consistent, and the timing of the completion of those process is a black box of systems
behavior, networking, and tuning.

To add this field to a model, you need to do a few preparatory steps:

1. Ensure that the 'model' pointed to by this field is in an opposing silo mode.  Tests *should*
   fail for any usage of a HybridCloudForeignKey (HCFK) that points from and to models in the same silo mode.
2. Ensure that the foreign model being referenced produces outboxes to sync tombstones in an atomic
   transaction. For most common cross silo models, there should be a custom delete method already that
   implements this. If not, it's ideal to first consult with the hybrid cloud team beforehand to
   strategize on the outbox and deletion strategies.
3. Validate that either the default, or the registered bulk deletions in
   sentry/deletions/__init__.py make sense for your model.  This is especially true if your model
    previously had no cascade logic (a new model, for instance)
4. For an existing field to a HCFK, django will produce a non-working migration by default.  There
   is no way to configure the auto generated django migrations, unfortunately.  You'll need to carefully
   build a migration by following this pattern:
    a. register a database operation that alters the field to a ForeignKey with db_constraint=False,
       in order to produce the custom sql of actually dropping the existing constraint in the database.
    b. register state operations that further adjust the internal django field state as follows:
        i. alters the original field to the new HybridCloudForeignKey (use the generated migration for this)
        ii. renames that field to the `_id` form (eg user => user_id)
        iii. removes, then re-adds, any other, say, unique constraints that depended on the original
             field.  They still exist, but due to ii, they need to be reconstructed in terms of the
             renamed field name, even if the column name is the same.
4a. Basically, don't change an existing field to HCFK.  The hybrid cloud team probably needs to carefully manage that.

Ideally, when applying this field, you write model test that validates that deletion of your parent model produces
the expected cascade behavior in your field.
"""

from __future__ import annotations

from enum import IntEnum
from typing import Any

from django.apps import apps
from django.db import models

from sentry.db.models.fields.types import FieldGetType, FieldSetType

__all__ = ("HybridCloudForeignKey",)


class HybridCloudForeignKeyCascadeBehavior(IntEnum):
    CASCADE = 1
    SET_NULL = 2
    DO_NOTHING = 3


class HybridCloudForeignKey(models.BigIntegerField[FieldSetType, FieldGetType]):
    @property
    def foreign_model(self) -> Any:
        parts = self.foreign_model_name.split(".")
        return apps.get_model(app_label=parts[0], model_name=parts[1])

    @property
    def foreign_table_name(self) -> str:
        return self.foreign_model._meta.db_table

    def __init__(
        self,
        foreign_model: str,
        *,
        on_delete: HybridCloudForeignKeyCascadeBehavior | str,
        **kwds: Any,
    ):
        self.on_delete = (
            on_delete
            if isinstance(on_delete, HybridCloudForeignKeyCascadeBehavior)
            else HybridCloudForeignKeyCascadeBehavior[on_delete.upper()]
        ).name.upper()

        parts = foreign_model.split(".")
        assert (
            len(parts) == 2
        ), f"{self.__class__.__name__} model reference must be <app>.<ModelName>, got {foreign_model}"
        self.foreign_model_name = foreign_model

        kwds.setdefault("db_index", True)
        super().__init__(**kwds)

    def deconstruct(self) -> tuple[Any, Any, Any, Any]:
        (name, path, args, kwds) = super().deconstruct()
        # This seems wrong, but due to the way django scrubs defaults, this will inevitably be wrong.
        kwds.setdefault("db_index", False)
        return name, path, [self.foreign_model_name], dict(on_delete=self.on_delete, **kwds)
