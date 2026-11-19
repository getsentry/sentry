import re
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg2
import pytest
from django.apps import apps
from django.db import IntegrityError, OperationalError, connection, models, transaction
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django_zero_downtime_migrations.backends.postgres.schema import UnsafeOperationException

from fixtures.partitions import (
    FIXTURE_TABLES,
    HashPartitionedFixture,
    RangePartitionedFixture,
    drop_fixture_tables,
    fixture_project_state,
    fixture_tables,
)
from sentry.db.partitions import sql
from sentry.db.partitions.catalog import (
    PartitionedTableInfo,
    get_partitioned_table_info,
    list_partitions,
)
from sentry.db.partitions.schema import partition_index_name
from sentry.db.postgres.schema import DatabaseSchemaEditorProxy, SafePostgresDatabaseSchemaEditor
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time

RANGE_TABLE = RangePartitionedFixture._meta.db_table
HASH_TABLE = HashPartitionedFixture._meta.db_table


def primary_key_columns(table: str) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT a.attname
            FROM pg_index AS i
            JOIN unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord) ON true
            JOIN pg_attribute AS a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
            WHERE i.indrelid = to_regclass(%s) AND i.indisprimary
            ORDER BY k.ord
            """,
            [table],
        )
        return [row[0] for row in cursor.fetchall()]


def index_state(name: str) -> tuple[bool, list[str]]:
    """Whether the index is valid, and the partitions with an attached index."""
    with connection.cursor() as cursor:
        cursor.execute(sql.INDEX_IS_VALID, [name])
        (valid,) = cursor.fetchone()
        cursor.execute(
            """
            SELECT t.relname
            FROM pg_inherits AS h
            JOIN pg_index AS i ON i.indexrelid = h.inhrelid
            JOIN pg_class AS t ON t.oid = i.indrelid
            WHERE h.inhparent = to_regclass(%s)
            ORDER BY t.relname
            """,
            [name],
        )
        return valid, [row[0] for row in cursor.fetchall()]


def foreign_keys(table: str) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT confrelid::regclass::text FROM pg_constraint "
            "WHERE conrelid = to_regclass(%s) AND contype = 'f' AND conparentid = 0",
            [table],
        )
        return [row[0] for row in cursor.fetchall()]


@contextmanager
def safe_editor() -> Iterator[SafePostgresDatabaseSchemaEditor]:
    with connection.schema_editor() as proxy:
        assert isinstance(proxy, DatabaseSchemaEditorProxy)
        proxy.safe = True
        editor = proxy.schema_editor
        assert isinstance(editor, SafePostgresDatabaseSchemaEditor)
        yield editor


class CreatePartitionedTableTest(TransactionTestCase):
    @freeze_time("2024-03-06 12:00:00")
    def test_range_partitioned(self) -> None:
        with fixture_tables():
            assert get_partitioned_table_info(connection, RANGE_TABLE) == PartitionedTableInfo(
                "range", ("date_added",)
            )
            assert primary_key_columns(RANGE_TABLE) == ["id", "date_added"]
            # The current week plus `premake=2` weeks ahead.
            assert [(p.name, p.bound) for p in list_partitions(connection, RANGE_TABLE)] == [
                (
                    f"{RANGE_TABLE}_p20240304",
                    "FOR VALUES FROM ('2024-03-04 00:00:00+00') TO ('2024-03-11 00:00:00+00')",
                ),
                (
                    f"{RANGE_TABLE}_p20240311",
                    "FOR VALUES FROM ('2024-03-11 00:00:00+00') TO ('2024-03-18 00:00:00+00')",
                ),
                (
                    f"{RANGE_TABLE}_p20240318",
                    "FOR VALUES FROM ('2024-03-18 00:00:00+00') TO ('2024-03-25 00:00:00+00')",
                ),
            ]
            # Indexes are created on the parent and cascade to partitions.
            assert index_state("fx_partitions_range_value_idx") == (
                True,
                [p.name for p in list_partitions(connection, RANGE_TABLE)],
            )
            assert foreign_keys(RANGE_TABLE) == []

    def test_hash_partitioned(self) -> None:
        with fixture_tables():
            assert get_partitioned_table_info(connection, HASH_TABLE) == PartitionedTableInfo(
                "hash", ("id",)
            )
            assert primary_key_columns(HASH_TABLE) == ["id"]
            # Created with the table, which Postgres 14 can't do NOT VALID.
            assert foreign_keys(HASH_TABLE) == ["sentry_project"]
            assert [p.bound for p in list_partitions(connection, HASH_TABLE)] == [
                f"FOR VALUES WITH (modulus 4, remainder {remainder})" for remainder in range(4)
            ]

    def test_not_enabled(self) -> None:
        with fixture_tables(partitioned=False):
            assert get_partitioned_table_info(connection, RANGE_TABLE) is None
            assert get_partitioned_table_info(connection, HASH_TABLE) is None
            assert primary_key_columns(RANGE_TABLE) == ["id"]

    def test_rows_are_routed_to_partitions(self) -> None:
        with fixture_tables():
            parents = HashPartitionedFixture.objects.bulk_create(
                [HashPartitionedFixture(name=str(i)) for i in range(20)]
            )
            RangePartitionedFixture.objects.create(value=1, parent=parents[0])
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT count(DISTINCT tableoid) FROM {HASH_TABLE}")
                assert cursor.fetchone() == (4,)
            row = RangePartitionedFixture.objects.get(value=1)
            assert RangePartitionedFixture.objects.filter(id=row.id, parent=parents[0]).exists()
            row.value = 2
            row.save()
            assert RangePartitionedFixture.objects.filter(value=2).count() == 1
            row.delete()
            assert not RangePartitionedFixture.objects.exists()

    @freeze_time("2024-03-06 12:00:00")
    def test_rows_outside_every_partition_fail(self) -> None:
        with fixture_tables():
            with pytest.raises(IntegrityError, match="no partition of relation"):
                RangePartitionedFixture.objects.create(date_added=timezone.now().replace(year=2023))

    def test_historical_model_is_resolved_by_table(self) -> None:
        state = fixture_project_state()
        historical = state.apps.get_model("fixtures", "HashPartitionedFixture")
        assert getattr(historical, "__partitioning__", None) is None

        drop_fixture_tables()
        try:
            with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
                with safe_editor() as editor:
                    editor.create_model(historical)
            assert get_partitioned_table_info(connection, HASH_TABLE) == PartitionedTableInfo(
                "hash", ("id",)
            )
        finally:
            drop_fixture_tables()


class PartitionedIndexTest(TransactionTestCase):
    index = models.Index(fields=["value", "date_added"], name="fx_partitions_range_vd_idx")

    def test_add_index(self) -> None:
        with fixture_tables():
            partitions = [p.name for p in list_partitions(connection, RANGE_TABLE)]
            with safe_editor() as editor:
                editor.add_index(RangePartitionedFixture, self.index)
            assert index_state(self.index.name) == (True, partitions)

            # Running it again, e.g. after a failed migration, is a no-op.
            with safe_editor() as editor:
                editor.add_index(RangePartitionedFixture, self.index)
            assert index_state(self.index.name) == (True, partitions)

            with safe_editor() as editor:
                editor.remove_index(RangePartitionedFixture, self.index)
            with connection.cursor() as cursor:
                cursor.execute(sql.TABLE_EXISTS, [self.index.name])
                assert cursor.fetchone() == (False,)

    def session_lock_timeout(self) -> str:
        with connection.cursor() as cursor:
            cursor.execute("SELECT setting || unit FROM pg_settings WHERE name = 'lock_timeout'")
            return cursor.fetchone()[0]

    def drop_statements(self) -> list[str]:
        with safe_editor() as editor:
            editor.add_index(RangePartitionedFixture, self.index)
        with CaptureQueriesContext(connection) as queries, safe_editor() as editor:
            editor.remove_index(RangePartitionedFixture, self.index)
        return [
            q["sql"]
            for q in queries.captured_queries
            if q["sql"].startswith(("SET lock_timeout", "DROP INDEX"))
        ]

    def test_remove_index_uses_configured_lock_timeout(self) -> None:
        with fixture_tables(), override_settings(ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT="10s"):
            previous = self.session_lock_timeout()
            assert self.drop_statements() == [
                "SET lock_timeout TO '10s'",
                'DROP INDEX IF EXISTS "fx_partitions_range_vd_idx"',
                f"SET lock_timeout TO '{previous}'",
            ]
            assert self.session_lock_timeout() == previous

    def test_remove_index_falls_back_to_default_lock_timeout(self) -> None:
        with fixture_tables(), override_settings(ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT=None):
            previous = self.session_lock_timeout()
            assert self.drop_statements() == [
                "SET lock_timeout TO '5s'",
                'DROP INDEX IF EXISTS "fx_partitions_range_vd_idx"',
                f"SET lock_timeout TO '{previous}'",
            ]
            assert self.session_lock_timeout() == previous

    def test_remove_index_gives_up_waiting_for_the_lock(self) -> None:
        with fixture_tables(), override_settings(ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT="100ms"):
            with safe_editor() as editor:
                editor.add_index(RangePartitionedFixture, self.index)
            # Any open transaction reading the table conflicts with the drop.
            reader = psycopg2.connect(**connection.get_connection_params())
            try:
                with reader.cursor() as cursor:
                    cursor.execute(f'SELECT 1 FROM "{RANGE_TABLE}" LIMIT 1')
                with pytest.raises(OperationalError, match="lock timeout"):
                    with safe_editor() as editor:
                        editor.remove_index(RangePartitionedFixture, self.index)
            finally:
                reader.close()
            assert index_state(self.index.name)[0] is True

    def test_add_index_replaces_invalid_partition_index(self) -> None:
        with fixture_tables():
            partition = list_partitions(connection, RANGE_TABLE)[0].name
            child = partition_index_name(self.index.name, partition)
            with connection.cursor() as cursor:
                cursor.execute(f'CREATE INDEX "{child}" ON "{partition}" (value)')
                cursor.execute(
                    "UPDATE pg_index SET indisvalid = false WHERE indexrelid = to_regclass(%s)",
                    [child],
                )
            with safe_editor() as editor:
                editor.add_index(RangePartitionedFixture, self.index)
            assert index_state(self.index.name)[0] is True
            with connection.cursor() as cursor:
                cursor.execute(sql.INDEX_IS_VALID, [child])
                assert cursor.fetchone() == (True,)

    def test_add_index_inside_a_transaction_is_rejected(self) -> None:
        with fixture_tables():
            with pytest.raises(UnsafeOperationException, match="non-atomic migration"):
                with transaction.atomic(using="default"), safe_editor() as editor:
                    editor.add_index(RangePartitionedFixture, self.index)

    def test_add_index_to_unpartitioned_table(self) -> None:
        with fixture_tables(partitioned=False):
            with safe_editor() as editor:
                editor.add_index(RangePartitionedFixture, self.index)
            assert index_state(self.index.name) == (True, [])


class PartitionedTableGuardsTest(TransactionTestCase):
    def add_field(self, field: models.Field[Any, Any], name: str = "extra") -> None:
        field.set_attributes_from_name(name)
        field.model = RangePartitionedFixture
        with safe_editor() as editor:
            editor.add_field(RangePartitionedFixture, field)

    def test_add_plain_fields(self) -> None:
        with fixture_tables():
            self.add_field(models.IntegerField(null=True))
            self.add_field(models.IntegerField(db_default=0), name="with_default")

    def test_add_unsafe_fields(self) -> None:
        with fixture_tables():
            with pytest.raises(UnsafeOperationException, match="unique field"):
                self.add_field(models.IntegerField(null=True, unique=True))
            with pytest.raises(UnsafeOperationException, match="indexed field"):
                self.add_field(models.IntegerField(null=True, db_index=True))
            with pytest.raises(UnsafeOperationException, match="foreign key"):
                field: models.Field[Any, Any] = models.ForeignKey(
                    HashPartitionedFixture, null=True, on_delete=models.CASCADE, related_name="+"
                )
                self.add_field(field, name="other")

    def test_unsafe_fields_are_allowed_on_unpartitioned_tables(self) -> None:
        with fixture_tables(partitioned=False):
            self.add_field(models.IntegerField(null=True, unique=True))

    def test_alter_partition_key(self) -> None:
        with fixture_tables():
            old = RangePartitionedFixture._meta.get_field("date_added")
            assert isinstance(old, models.Field)
            new: models.Field[Any, Any] = models.DateTimeField(null=True)
            new.set_attributes_from_name("date_added")
            with pytest.raises(UnsafeOperationException, match="is the partition key"):
                with safe_editor() as editor:
                    editor.alter_field(RangePartitionedFixture, old, new)

    def test_alter_field_to_add_an_index(self) -> None:
        with fixture_tables():
            old = RangePartitionedFixture._meta.get_field("value")
            assert isinstance(old, models.Field)
            new: models.Field[Any, Any] = models.IntegerField(null=True, db_index=True)
            new.set_attributes_from_name("value")
            with pytest.raises(UnsafeOperationException, match="Adding db_index"):
                with safe_editor() as editor:
                    editor.alter_field(RangePartitionedFixture, old, new)

    def test_constraints(self) -> None:
        with fixture_tables():
            with safe_editor() as editor:
                editor.add_constraint(
                    RangePartitionedFixture,
                    models.CheckConstraint(
                        condition=models.Q(value__gte=0), name="fx_partitions_range_value_check"
                    ),
                )
            with pytest.raises(UnsafeOperationException, match="unique constraint"):
                with safe_editor() as editor:
                    editor.add_constraint(
                        RangePartitionedFixture,
                        models.UniqueConstraint(
                            fields=["value", "date_added"], name="fx_partitions_range_uniq"
                        ),
                    )
            with pytest.raises(UnsafeOperationException, match="unique_together"):
                with safe_editor() as editor:
                    editor.alter_unique_together(
                        RangePartitionedFixture, [], [("value", "date_added")]
                    )


class GeneratedDdlTest(TestCase):
    def collect_create_sql(self, model: type[models.Model], partitioned: bool) -> list[str]:
        tables = [model._meta.db_table] if partitioned else []
        with override_settings(SENTRY_PARTITIONED_TABLES=tables):
            with connection.schema_editor(collect_sql=True) as proxy:
                assert isinstance(proxy, DatabaseSchemaEditorProxy)
                proxy.safe = True
                proxy.create_model(model)
                return [str(s) for s in proxy.collected_sql]

    def test_ddl_is_postgres_14_compatible(self) -> None:
        statements = self.collect_create_sql(RangePartitionedFixture, True)
        statements += self.collect_create_sql(HashPartitionedFixture, True)
        assert any("PARTITION BY RANGE" in s for s in statements)
        assert [
            s
            for s in statements
            if any(re.search(p, s, re.IGNORECASE) for p in sql.POSTGRES_14_INCOMPATIBLE)
        ] == []
        # The safe editor's CONCURRENTLY and NOT VALID variants fail on partitioned tables.
        assert [s for s in statements if "CONCURRENTLY" in s or "NOT VALID" in s] == []

    def test_setting_does_not_change_ddl_of_undeclared_models(self) -> None:
        all_models = [
            m
            for m in apps.get_models()
            if m._meta.managed and not m._meta.proxy and m._meta.db_table not in FIXTURE_TABLES
        ]
        all_tables = [m._meta.db_table for m in all_models]

        def create_sql() -> list[str]:
            with connection.schema_editor(collect_sql=True) as proxy:
                assert isinstance(proxy, DatabaseSchemaEditorProxy)
                proxy.safe = True
                for model in all_models:
                    proxy.create_model(model)
                return [str(s) for s in proxy.collected_sql]

        with override_settings(SENTRY_PARTITIONED_TABLES=[]):
            baseline = create_sql()
        with override_settings(SENTRY_PARTITIONED_TABLES=all_tables):
            assert create_sql() == baseline
        assert len(baseline) > len(all_models)
        assert not any("PARTITION BY" in s for s in baseline)
