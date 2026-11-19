from datetime import UTC, datetime

import pytest
from django.db import connection
from django.test import override_settings

from fixtures.partitions import (
    FIXTURE_TABLES,
    HashPartitionedFixture,
    RangePartitionedFixture,
    drop_fixture_tables,
    fixture_tables,
)
from sentry.db.partitions.catalog import (
    PartitionInfo,
    is_partitioned,
    table_exists,
    verify_partition_state,
)
from sentry.testutils.cases import TransactionTestCase

RANGE_TABLE = RangePartitionedFixture._meta.db_table
HASH_TABLE = HashPartitionedFixture._meta.db_table


def test_range_bounds() -> None:
    partition = PartitionInfo(
        "p",
        "FOR VALUES FROM ('2024-03-04 00:00:00+00') TO ('2024-03-11 00:00:00+00')",
        detach_pending=False,
    )
    assert partition.range_bounds() == (
        datetime(2024, 3, 4, tzinfo=UTC),
        datetime(2024, 3, 11, tzinfo=UTC),
    )


def test_range_bounds_with_min_and_max_values() -> None:
    partition = PartitionInfo(
        "p", "FOR VALUES FROM (MINVALUE) TO ('2024-03-11 00:00:00+01')", detach_pending=False
    )
    assert partition.range_bounds() == (None, datetime(2024, 3, 10, 23, tzinfo=UTC))


def test_range_bounds_of_hash_partition() -> None:
    partition = PartitionInfo("p", "FOR VALUES WITH (modulus 4, remainder 0)", detach_pending=False)
    with pytest.raises(ValueError):
        partition.range_bounds()


class VerifyPartitionStateTest(TransactionTestCase):
    def test_matching_state(self) -> None:
        with fixture_tables():
            with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
                assert verify_partition_state() == []
            assert is_partitioned(RangePartitionedFixture)

    def test_missing_tables_are_skipped(self) -> None:
        drop_fixture_tables()
        assert not table_exists(connection, RANGE_TABLE)
        with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
            assert verify_partition_state() == []

    def test_enabled_but_not_partitioned(self) -> None:
        with fixture_tables(partitioned=False):
            assert not is_partitioned(RangePartitionedFixture)
            with override_settings(SENTRY_PARTITIONED_TABLES=[RANGE_TABLE]):
                assert verify_partition_state() == [
                    f"{RANGE_TABLE} is in SENTRY_PARTITIONED_TABLES but is not partitioned."
                ]

    def test_partitioned_but_not_enabled(self) -> None:
        with fixture_tables():
            with override_settings(SENTRY_PARTITIONED_TABLES=[RANGE_TABLE]):
                assert verify_partition_state() == [
                    f"{HASH_TABLE} is partitioned but is not in SENTRY_PARTITIONED_TABLES."
                ]

    def test_hash_partition_count_mismatch(self) -> None:
        with fixture_tables():
            with connection.cursor() as cursor:
                cursor.execute(f'ALTER TABLE "{HASH_TABLE}" DETACH PARTITION "{HASH_TABLE}_h03"')
            with override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
                assert verify_partition_state() == [
                    f"{HASH_TABLE} has 3 hash partitions, but its model declares modulus 4."
                ]

    def test_undeclared_table_in_setting(self) -> None:
        drop_fixture_tables()
        with override_settings(SENTRY_PARTITIONED_TABLES=["sentry_undeclared"]):
            assert verify_partition_state() == [
                "sentry_undeclared is in SENTRY_PARTITIONED_TABLES but no model declares "
                "`__partitioning__`."
            ]
