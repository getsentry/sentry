from datetime import UTC, datetime

from django.db import connection

from fixtures.partitions import (
    RangePartitionedFixture,
    fixture_project_state,
    fixture_tables,
)
from sentry.db.partitions.catalog import list_partitions
from sentry.new_migrations.operations import EnsurePartitions
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time

RANGE_TABLE = RangePartitionedFixture._meta.db_table


def run(operation: EnsurePartitions) -> None:
    state = fixture_project_state()
    with connection.schema_editor() as editor:
        operation.database_forwards("fixtures", editor, state, state)


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
