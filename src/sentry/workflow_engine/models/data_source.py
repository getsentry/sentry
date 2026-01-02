import builtins
import dataclasses
import logging
from typing import Generic, TypeVar

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.backup.dependencies import NormalizedModelName, PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclasses.dataclass
class DataPacket(Generic[T]):
    source_id: str
    packet: T


@region_silo_model
class DataSource(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization
    # DataSource.source_id dynamically references different models based on the 'type' field.
    # We declare all possible dependencies here to ensure proper import ordering.
    __relocation_dependencies__ = {
        "monitors.monitor",  # For DATA_SOURCE_CRON_MONITOR
        "sentry.querysubscription",  # For DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
        "uptime.uptimesubscription",  # For DATA_SOURCE_UPTIME_SUBSCRIPTION
    }

    organization = FlexibleForeignKey("sentry.Organization")

    # source_id is used in a composite index with type to dynamically lookup the data source
    source_id = models.TextField()

    # This is a dynamic field, depending on the type in the data_source_type_registry
    type = models.TextField()

    detectors = models.ManyToManyField("workflow_engine.Detector", through=DataSourceDetector)

    class Meta:
        indexes = [
            models.Index(fields=("organization", "type", "source_id")),
        ]
        constraints = [
            models.UniqueConstraint(fields=["type", "source_id"], name="unique_type_source_id"),
        ]

    @property
    def type_handler(self) -> builtins.type[DataSourceTypeHandler]:
        handler = data_source_type_registry.get(self.type)
        if not handler:
            raise ValueError(f"Unknown data source type: {self.type}")
        return handler

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        old_pk = super().normalize_before_relocation_import(pk_map, scope, flags)
        if old_pk is None:
            return None

        # Map source_id based on the data source type
        try:
            handler = data_source_type_registry.get(self.type)
            model_name = NormalizedModelName(handler.get_relocation_model_name())
            old_source_id = int(self.source_id)
            new_source_id = pk_map.get_pk(model_name, old_source_id)

            if new_source_id is None:
                # Referenced model not in pk_map - the source was filtered out or failed to import.
                return None

            self.source_id = str(new_source_id)
        except Exception:
            logger.exception(
                "DataSource.normalize_before_relocation_import failed",
                extra={"data_source_id": old_pk, "type": self.type, "source_id": self.source_id},
            )
            return None

        return old_pk


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
