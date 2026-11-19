from datetime import UTC, datetime, timedelta

from django.db import connection, models
from django.db.migrations import AddField, CreateModel
from django.db.migrations.optimizer import MigrationOptimizer
from django.db.migrations.serializer import serializer_factory
from django.db.migrations.state import ModelState
from django.db.migrations.writer import OperationWriter
from django.test import override_settings

from fixtures.partitions import (
    FIXTURE_TABLES,
    HashPartitionedFixture,
    RangePartitionedFixture,
    drop_fixture_tables,
    fixture_project_state,
    fixture_tables,
)
from sentry.db.partitions import HashPartitioning, PartitionInterval, RangePartitioning
from sentry.db.partitions.catalog import (
    PartitionedTableInfo,
    get_partitioned_table_info,
    list_partitions,
    table_exists,
)
from sentry.new_migrations.operations import CreatePartitionedModel, EnsurePartitions
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time

RANGE_TABLE = RangePartitionedFixture._meta.db_table
HASH_TABLE = HashPartitionedFixture._meta.db_table


def run(operation: EnsurePartitions | CreatePartitionedModel) -> None:
    state = fixture_project_state()
    with connection.schema_editor() as editor:
        operation.database_forwards("fixtures", editor, state, state)


def create_hash_fixture() -> CreatePartitionedModel:
    model_state = ModelState.from_model(HashPartitionedFixture)
    return CreatePartitionedModel(
        name=model_state.name,
        fields=list(model_state.fields.items()),
        options=model_state.options,
        partitioning=HashPartitioning("id", modulus=4),
    )


def roundtrip(value: object) -> object:
    """Serialize ``value`` the way migration files do, and evaluate it again."""
    string, imports = serializer_factory(value).serialize()
    namespace: dict[str, object] = {}
    for statement in imports:
        exec(statement, namespace)
    return eval(string, namespace)


class CreatePartitionedModelTest(TransactionTestCase):
    def test_creates_partitioned_table(self) -> None:
        drop_fixture_tables()
        try:
            with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
                run(create_hash_fixture())
            assert get_partitioned_table_info(connection, HASH_TABLE) == PartitionedTableInfo(
                "hash", ("id",)
            )
        finally:
            drop_fixture_tables()

    def test_creates_plain_table_when_not_enabled(self) -> None:
        drop_fixture_tables()
        try:
            with override_settings(SENTRY_PARTITIONED_TABLES=[]):
                run(create_hash_fixture())
            assert table_exists(connection, HASH_TABLE)
            assert get_partitioned_table_info(connection, HASH_TABLE) is None
        finally:
            drop_fixture_tables()


class CreatePartitionedModelSerializationTest(TestCase):
    def test_partitioning_survives_a_migration_file(self) -> None:
        range_spec = RangePartitioning(
            "date_added", PartitionInterval.WEEK, premake=2, retention=timedelta(days=90)
        )
        hash_spec = HashPartitioning("id", modulus=16)
        assert roundtrip(range_spec) == range_spec
        assert roundtrip(hash_spec) == hash_spec

    def test_operation_is_written_with_its_partitioning(self) -> None:
        string, imports = OperationWriter(create_hash_fixture(), indentation=0).serialize()
        assert string.startswith("sentry.new_migrations.operations.CreatePartitionedModel(")
        assert "partitioning=sentry.db.partitions.HashPartitioning('id', modulus=4)," in string
        assert {"import sentry.new_migrations.operations", "import sentry.db.partitions"} <= (
            imports
        )
        assert create_hash_fixture().describe() == (
            "Create partitioned model HashPartitionedFixture"
        )

    def test_optimizer_keeps_the_partitioning(self) -> None:
        create = create_hash_fixture()
        add_field = AddField("HashPartitionedFixture", "extra", models.IntegerField(null=True))
        assert MigrationOptimizer().optimize([create, add_field], "fixtures") == [
            create,
            add_field,
        ]
        # A plain CreateModel would be merged.
        plain = CreateModel(create.name, create.fields, create.options)
        assert len(MigrationOptimizer().optimize([plain, add_field], "fixtures")) == 1


class EnsurePartitionsTest(TransactionTestCase):
    def test_creates_partitions_for_historical_model(self) -> None:
        with freeze_time(datetime(2024, 3, 6, tzinfo=UTC)), fixture_tables():
            with freeze_time(datetime(2024, 3, 20, tzinfo=UTC)):
                run(EnsurePartitions("RangePartitionedFixture"))
            assert [p.name for p in list_partitions(connection, RANGE_TABLE)][-2:] == [
                f"{RANGE_TABLE}_p20240325",
                f"{RANGE_TABLE}_p20240401",
            ]

    def test_does_nothing_for_unpartitioned_tables(self) -> None:
        with fixture_tables(partitioned=False):
            run(EnsurePartitions("RangePartitionedFixture"))
            run(EnsurePartitions("HashPartitionedFixture"))
            assert list_partitions(connection, RANGE_TABLE) == []

    def test_deconstruct(self) -> None:
        operation = EnsurePartitions("RangePartitionedFixture")
        assert operation.deconstruct() == (
            "EnsurePartitions",
            [],
            {"model_name": "RangePartitionedFixture"},
        )
        assert operation.describe() == "Ensure partitions exist for RangePartitionedFixture"
