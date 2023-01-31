"""
A 'foreign key' which is not enforced in the local database, but triggers eventually consistent delete work in the
presence of RegionTombstone ControlTombstone model objects through the tasks/deletion.py script.

This column is, in fact, an integer, and cannot enforce integrity directly.  It's main purpose to simply to track
the need for cleanup in the case of a resource which is tracked in an opposing SiloMode.
"""
from __future__ import annotations

from enum import IntEnum

from django.db import models

__all__ = "HybridCloudForeignKey"

from django.apps import apps


class HybridCloudForeignKeyCascadeBehavior(IntEnum):
    CASCADE = 1
    SET_NULL = 2


class HybridCloudForeignKey(models.BigIntegerField):  # type: ignore
    foreign_table_name: str
    foreign_model: type  # In the future, this might get dropped in favor of just the foreign_table_name.
    on_delete: HybridCloudForeignKeyCascadeBehavior

    def __init__(
        self, foreign_model: str, *, on_delete: HybridCloudForeignKeyCascadeBehavior | str, **kwds
    ):
        self.on_delete = (
            on_delete
            if isinstance(on_delete, HybridCloudForeignKeyCascadeBehavior)
            else HybridCloudForeignKeyCascadeBehavior[on_delete.upper()]
        )

        parts = foreign_model.split(".")
        assert (
            len(parts) == 2
        ), f"{self.__class__.__name__} model reference must be <app>.<ModelName>, got {foreign_model}"
        self.foreign_model = model = apps.get_model(app_label=parts[0], model_name=parts[1])
        foreign_table_name = model._meta.db_table

        self.foreign_table_name = foreign_table_name

        super().__init__(db_index=True, **kwds)
