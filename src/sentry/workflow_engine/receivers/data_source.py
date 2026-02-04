from typing import Any

from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import DataSource
from sentry.workflow_engine.registry import data_source_type_registry


@receiver(pre_save, sender=DataSource)
def ensure_type_handler_registered(
    sender: type[DataSource], instance: DataSource, **kwargs: Any
) -> None:
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
