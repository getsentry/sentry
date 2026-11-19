from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

from django.db import connection, models
from django.db.migrations.state import ModelState, ProjectState
from django.test import override_settings
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning


@cell_silo_model
class HashPartitionedFixture(Model):
    __relocation_scope__ = RelocationScope.Excluded
    __partitioning__ = HashPartitioning("id", modulus=4)

    name = models.CharField(max_length=64)
    # Hash partitioned tables can have database foreign keys to other tables.
    project = FlexibleForeignKey("sentry.Project", null=True)

    class Meta:
        app_label = "fixtures"
        db_table = "fixtures_partitions_hash"
        constraints = [
            models.UniqueConstraint(fields=["id", "name"], name="fx_partitions_hash_id_name_uniq")
        ]


@cell_silo_model
class RangePartitionedFixture(Model):
    __relocation_scope__ = RelocationScope.Excluded
    __partitioning__ = RangePartitioning(
        "date_added", PartitionInterval.WEEK, premake=2, retention=timedelta(weeks=4)
    )

    date_added = models.DateTimeField(default=timezone.now)
    value = models.IntegerField(null=True)
    # Range partitioned tables can't have database foreign keys.
    parent = FlexibleForeignKey(HashPartitionedFixture, null=True, db_constraint=False)

    class Meta:
        app_label = "fixtures"
        db_table = "fixtures_partitions_range"
        indexes = [models.Index(fields=["value"], name="fx_partitions_range_value_idx")]


FIXTURE_MODELS: tuple[type[Model], ...] = (HashPartitionedFixture, RangePartitionedFixture)
FIXTURE_TABLES = frozenset(model._meta.db_table for model in FIXTURE_MODELS)


def fixture_project_state() -> ProjectState:
    """Migration state with the fixture models, as historical models see them."""
    state = ProjectState()
    # Stands in for the real model, which the hash fixture has a foreign key to.
    state.add_model(
        ModelState("sentry", "Project", [("id", BoundedBigAutoField(primary_key=True))])
    )
    for model in FIXTURE_MODELS:
        state.add_model(ModelState.from_model(model))
    return state


def drop_fixture_tables() -> None:
    """
    Drop the fixture tables that exist. Dropping a partitioned table also drops its
    attached partitions. Detached partitions are standalone tables, so a test that
    detaches one has to drop it itself.
    """
    existing = set(connection.introspection.table_names())
    with connection.schema_editor() as editor:
        for model in reversed(FIXTURE_MODELS):
            if model._meta.db_table in existing:
                editor.delete_model(model)


@contextmanager
def fixture_tables(partitioned: bool = True) -> Iterator[None]:
    """Create the fixture tables, partitioned or not, and drop them afterwards."""
    drop_fixture_tables()
    with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES if partitioned else []):
        with connection.schema_editor() as editor:
            for model in FIXTURE_MODELS:
                editor.create_model(model)
        try:
            yield
        finally:
            drop_fixture_tables()
