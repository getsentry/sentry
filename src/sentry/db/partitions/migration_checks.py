"""
Checks that partitioning declarations match the migrations that create their tables.

Migrations record how a table is partitioned in ``CreatePartitionedModel``. A model
whose table is created by a plain ``CreateModel`` is an existing table, and declaring
partitioning on it doesn't convert it, so that is reported as an error.
"""

from __future__ import annotations

from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass

from django.db import models
from django.db.migrations import SeparateDatabaseAndState
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.operations.base import Operation
from django.db.migrations.operations.models import CreateModel

from sentry.db.partitions.registry import get_declared_partitioning
from sentry.new_migrations.operations import CreatePartitionedModel


@dataclass(frozen=True)
class CreatedModel:
    app_label: str
    migration: str
    operation: CreateModel


def _database_operations(operations: Sequence[Operation]) -> Iterator[Operation]:
    for operation in operations:
        if isinstance(operation, SeparateDatabaseAndState):
            yield from _database_operations(operation.database_operations)
        else:
            yield operation


def iter_created_models(loader: MigrationLoader) -> Iterator[CreatedModel]:
    for (app_label, name), migration in sorted(loader.disk_migrations.items()):
        for operation in _database_operations(migration.operations):
            if isinstance(operation, CreateModel):
                yield CreatedModel(app_label, name, operation)


def get_partitioning_migration_errors(
    created_models: Iterable[CreatedModel], all_models: Iterable[type[models.Model]]
) -> list[str]:
    # A model that is deleted and created again is created by its last CreateModel.
    by_model = {(c.app_label, c.operation.name_lower): c for c in created_models}
    errors = []
    for model in all_models:
        created = by_model.get((model._meta.app_label, model._meta.model_name or ""))
        if created is None:
            continue
        declared = get_declared_partitioning(model)
        recorded = (
            created.operation.partitioning
            if isinstance(created.operation, CreatePartitionedModel)
            else None
        )
        where = f"{created.app_label}.{created.migration}"
        if declared is None and recorded is not None:
            errors.append(
                f"{model._meta.label} is created by CreatePartitionedModel in {where}, but "
                f"doesn't declare `__partitioning__`."
            )
        elif declared is not None and recorded is None:
            errors.append(
                f"{model._meta.label} declares `__partitioning__`, but its table is created by "
                f"a plain CreateModel in {where}. Only new models can be partitioned, with "
                f"CreatePartitionedModel. Declaring partitioning doesn't convert an existing "
                f"table."
            )
        elif (
            declared is not None and recorded is not None and declared.layout() != recorded.layout()
        ):
            errors.append(
                f"{model._meta.label} declares {declared}, but {where} created its table with "
                f"{recorded}. How a table is partitioned can't change."
            )
    return errors
