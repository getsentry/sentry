from __future__ import annotations

from enum import StrEnum
from typing import ClassVar, Self, TypedDict

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.db.models.manager.base import BaseManager
from sentry.db.models.utils import is_model_attr_cached
from sentry.workflow_engine.models.data_condition import DataConditionSnapshot


class DataConditionGroupSnapshot(TypedDict):
    id: int
    logic_type: DataConditionGroup.Type
    conditions: list[DataConditionSnapshot]


@region_silo_model
class DataConditionGroup(DefaultFieldsModel):
    """
    A data group is a way to specify a group of conditions that must be met for a workflow action to execute
    """

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=["id"])

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("logic_type")

    class Type(StrEnum):
        # ANY will evaluate all conditions, and return true if any of those are met
        ANY = "any"

        # ANY_SHORT_CIRCUIT will stop evaluating conditions as soon as one is met
        ANY_SHORT_CIRCUIT = "any-short"

        # ALL will evaluate all conditions, and return true if all of those are met
        ALL = "all"

        # NONE will return true if none of the conditions are met, will return false immediately if any are met
        NONE = "none"

    logic_type = models.CharField(
        max_length=200, choices=[(t.value, t.value) for t in Type], default=Type.ANY
    )
    organization = models.ForeignKey("sentry.Organization", on_delete=models.CASCADE)

    def get_snapshot(self) -> DataConditionGroupSnapshot:
        conditions = []
        if is_model_attr_cached(self, "conditions"):
            conditions = [cond.get_snapshot() for cond in self.conditions.all()]

        return {
            "id": self.id,
            "logic_type": DataConditionGroup.Type(self.logic_type),
            "conditions": conditions,
        }
