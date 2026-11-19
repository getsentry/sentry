from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

import psycopg2
from django.db import OperationalError, connection, models
from django.db.migrations.state import ModelState, ProjectState
from django.test import override_settings
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning
from sentry.db.partitions.catalog import list_detached_range_partitions


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
    attached partitions. Detached range partitions are standalone tables, so they are
    dropped too, in case a test that detaches one fails before dropping it.
    """
    existing = set(connection.introspection.table_names())
    with connection.schema_editor() as editor:
        for model in reversed(FIXTURE_MODELS):
            if model._meta.db_table in existing:
                editor.delete_model(model)
    detached = list_detached_range_partitions(connection, RangePartitionedFixture._meta.db_table)
    with connection.cursor() as cursor:
        for partition in detached:
            cursor.execute(f"DROP TABLE {connection.ops.quote_name(partition.name)}")


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


def leave_detach_pending(partition: str) -> None:
    """
    Leave a partition of the range fixture table "detach pending", like a concurrent
    detach that hit its lock timeout: an open transaction on the table makes the
    second phase of the detach wait until the timeout cancels it.
    """
    table = connection.ops.quote_name(RangePartitionedFixture._meta.db_table)
    reader = psycopg2.connect(**connection.get_connection_params())
    try:
        with reader.cursor() as cursor:
            cursor.execute(f"SELECT 1 FROM {table} LIMIT 1")
        with connection.cursor() as cursor:
            cursor.execute("SET lock_timeout TO '100ms'")
            try:
                cursor.execute(
                    f"ALTER TABLE {table} DETACH PARTITION "
                    f"{connection.ops.quote_name(partition)} CONCURRENTLY"
                )
            except OperationalError as e:
                if "lock timeout" not in str(e):
                    raise
            else:
                raise AssertionError(f"Detaching {partition} wasn't interrupted.")
            finally:
                cursor.execute("SET lock_timeout TO DEFAULT")
    finally:
        reader.close()
