from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import timedelta

from django.db import connection, models
from django.test import override_settings
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning


@cell_silo_model
class HashPartitionedFixture(Model):
    __relocation_scope__ = RelocationScope.Excluded
    __partitioning__ = HashPartitioning("id", modulus=4)

    name = models.CharField(max_length=64)

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
    parent = FlexibleForeignKey(HashPartitionedFixture, null=True)

    class Meta:
        app_label = "fixtures"
        db_table = "fixtures_partitions_range"
        indexes = [models.Index(fields=["value"], name="fx_partitions_range_value_idx")]


FIXTURE_MODELS: tuple[type[Model], ...] = (HashPartitionedFixture, RangePartitionedFixture)
FIXTURE_TABLES = frozenset(model._meta.db_table for model in FIXTURE_MODELS)


def drop_fixture_tables() -> None:
    with connection.cursor() as cursor:
        # Includes partitions, and detached partitions, which outlive their parent.
        cursor.execute(
            "SELECT relname FROM pg_class WHERE relkind IN ('r', 'p') AND relname LIKE %s",
            ["fixtures\\_partitions\\_%"],
        )
        tables = [row[0] for row in cursor.fetchall()]
        if tables:
            cursor.execute(
                "DROP TABLE IF EXISTS {} CASCADE".format(", ".join(f'"{t}"' for t in tables))
            )


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
