from __future__ import annotations

from collections.abc import Iterator

from django.apps import apps
from django.conf import settings
from django.db import models

from sentry.db.partitions.spec import PartitioningSpec


def get_declared_partitioning(model: type[models.Model]) -> PartitioningSpec | None:
    """The partitioning declared on a live model class."""
    return getattr(model, "__partitioning__", None)


def iter_partitioned_models() -> Iterator[tuple[type[models.Model], PartitioningSpec]]:
    for model in apps.get_models():
        spec = get_declared_partitioning(model)
        if spec is not None:
            yield model, spec


def get_partitioned_model_for_table(db_table: str) -> type[models.Model] | None:
    for model, _ in iter_partitioned_models():
        if model._meta.db_table == db_table:
            return model
    return None


def resolve_partitioning(model: type[models.Model]) -> PartitioningSpec | None:
    """
    The partitioning declared for ``model``'s table.

    Historical models built from migration state do not carry class attributes like
    ``__partitioning__``, so for those the declaration is looked up on the live model
    with the same table name.
    """
    spec = get_declared_partitioning(model)
    if spec is not None:
        return spec
    live_model = get_partitioned_model_for_table(model._meta.db_table)
    if live_model is None:
        return None
    return get_declared_partitioning(live_model)


def is_partitioning_enabled(db_table: str) -> bool:
    """Whether this environment wants ``db_table`` to be created partitioned."""
    return db_table in settings.SENTRY_PARTITIONED_TABLES


def get_enabled_partitioning(model: type[models.Model]) -> PartitioningSpec | None:
    """The declaration to use when creating ``model``'s table in this environment."""
    if not is_partitioning_enabled(model._meta.db_table):
        return None
    return resolve_partitioning(model)


def get_partition_field(
    model: type[models.Model], spec: PartitioningSpec
) -> models.Field[object, object]:
    field = model._meta.get_field(spec.field)
    if not isinstance(field, models.Field):
        raise TypeError(f"{model.__name__}.{spec.field} is not a concrete field.")
    return field


def get_partition_column(model: type[models.Model], spec: PartitioningSpec) -> str:
    return get_partition_field(model, spec).column
