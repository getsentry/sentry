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

from typing import Any, Tuple

from django.apps import apps


class HybridCloudForeignKeyCascadeBehavior(IntEnum):
    CASCADE = 1
    SET_NULL = 2


class HybridCloudForeignKey(models.BigIntegerField):  # type: ignore
    on_delete: HybridCloudForeignKeyCascadeBehavior
    foreign_model_name: str

    @property
    def foreign_model(self) -> Any:
        parts = self.foreign_model_name.split(".")
        return apps.get_model(app_label=parts[0], model_name=parts[1])

    @property
    def foreign_table_name(self) -> str:
        return self.foreign_model._meta.db_table

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
        self.foreign_model_name = foreign_model

        kwds.setdefault("db_index", True)
        super().__init__(**kwds)

    def deconstruct(self) -> Tuple[Any, Any, Any, Any]:
        (name, path, args, kwds) = super().deconstruct()
        return name, path, [self.foreign_model_name], dict(on_delete=self.on_delete, **kwds)
