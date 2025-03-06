import builtins
import dataclasses
from typing import Generic, TypeVar

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

T = TypeVar("T")


@dataclasses.dataclass
class DataPacket(Generic[T]):
    source_id: str
    packet: T


@region_silo_model
class DataSource(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")

    # source_id is used in a composite index with type to dynamically lookup the data source
    source_id = models.TextField()

    # This is a dynamic field, depending on the type in the data_source_type_registry
    type = models.TextField()

    detectors = models.ManyToManyField("workflow_engine.Detector", through=DataSourceDetector)

    indexes = [
        models.Index(fields=("type", "source_id")),
        models.Index(fields=("organization", "type", "source_id")),
    ]

    @property
    def type_handler(self) -> builtins.type[DataSourceTypeHandler]:
        handler = data_source_type_registry.get(self.type)
        if not handler:
            raise ValueError(f"Unknown data source type: {self.type}")
        return handler


@receiver(pre_save, sender=DataSource)
def ensure_type_handler_registered(sender, instance: DataSource, **kwargs):
    """
    Ensure that the type of the data source is valid and registered in the data_source_type_registry
    """
    data_source_type = instance.type

    if not data_source_type:
        raise ValueError(f"No group type found with type {instance.type}")

    try:
        data_source_type_registry.get(data_source_type)
    except NoRegistrationExistsError:
        raise ValueError(f"No data source type found with type {data_source_type}")
