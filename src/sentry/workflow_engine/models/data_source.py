import builtins
import dataclasses
from typing import Generic, TypeVar

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

T = TypeVar("T")


@dataclasses.dataclass
class DataPacket(Generic[T]):
    query_id: str
    packet: T


@region_silo_model
class DataSource(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    query_id = BoundedBigIntegerField()
    type = models.TextField()

    detectors = models.ManyToManyField("workflow_engine.Detector", through=DataSourceDetector)

    indexes = [
        models.Index(fields=("type", "query_id")),
        models.Index(fields=("organization", "type", "query_id")),
    ]

    @property
    def type_handler(self) -> builtins.type[DataSourceTypeHandler]:
        handler = data_source_type_registry.get(self.type)
        if not handler:
            raise ValueError(f"Unknown data source type: {self.type}")
        return handler
