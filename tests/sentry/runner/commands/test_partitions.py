from datetime import UTC, datetime

from click.testing import CliRunner, Result
from django.db import connection
from django.test import override_settings

from fixtures.partitions import (
    FIXTURE_TABLES,
    RangePartitionedFixture,
    fixture_tables,
)
from sentry.runner.commands.partitions import partitions
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time

RANGE_TABLE = RangePartitionedFixture._meta.db_table


def invoke(*args: str) -> Result:
    return CliRunner().invoke(partitions, args, obj={})


class PartitionsCommandTest(TransactionTestCase):
    @freeze_time(datetime(2024, 3, 6, tzinfo=UTC))
    def test_status(self) -> None:
        with fixture_tables(), override_settings(SENTRY_PARTITIONED_TABLES=FIXTURE_TABLES):
            result = invoke("status", "--table", RANGE_TABLE)
        assert result.exit_code == 0, result.output
        assert f"{RANGE_TABLE}\n" in result.output
        assert "database: range date_added" in result.output
        assert f"{RANGE_TABLE}_p20240304: FOR VALUES FROM" in result.output

    def test_status_reports_problems(self) -> None:
        with fixture_tables(partitioned=False):
            with override_settings(SENTRY_PARTITIONED_TABLES=[RANGE_TABLE]):
                result = invoke("status")
        assert result.exit_code == 1
        assert f"PROBLEM: {RANGE_TABLE} is in SENTRY_PARTITIONED_TABLES" in result.output

    def test_status_of_one_table_only_reports_its_problems(self) -> None:
        # The hash table is partitioned but not listed.
        with fixture_tables(), override_settings(SENTRY_PARTITIONED_TABLES=[RANGE_TABLE]):
            one = invoke("status", "--table", RANGE_TABLE)
            every = invoke("status")
        assert one.exit_code == 0, one.output
        assert "PROBLEM" not in one.output
        assert every.exit_code == 1
        assert "PROBLEM: fixtures_partitions_hash is partitioned" in every.output

    def test_unknown_table(self) -> None:
        result = invoke("ensure", "--table", "sentry_unknown")
        assert result.exit_code == 1
        assert "No model declares partitioning for table sentry_unknown." in result.output

    def test_ensure_and_expire(self) -> None:
        with freeze_time(datetime(2024, 3, 6, tzinfo=UTC)), fixture_tables():
            with freeze_time(datetime(2024, 4, 9, tzinfo=UTC)):
                result = invoke("ensure", "--table", RANGE_TABLE)
                assert result.exit_code == 0, result.output
                assert result.output.splitlines() == [
                    f"Created {RANGE_TABLE}_p20240408",
                    f"Created {RANGE_TABLE}_p20240415",
                    f"Created {RANGE_TABLE}_p20240422",
                ]

                # Without --execute nothing is dropped.
                for _ in range(2):
                    result = invoke("expire")
                    assert result.exit_code == 0, result.output
                    assert result.output.splitlines() == [
                        f"Would drop {RANGE_TABLE}_p20240304",
                        "Dry run. Pass --execute to drop these partitions.",
                    ]

                result = invoke("expire", "--execute")
                assert result.exit_code == 0, result.output
                assert result.output.splitlines() == [f"Dropped {RANGE_TABLE}_p20240304"]

                result = invoke("expire", "--execute")
                assert result.exit_code == 0, result.output
                assert result.output == ""

    def test_expire_reports_a_default_partition_without_a_traceback(self) -> None:
        with fixture_tables():
            with connection.cursor() as cursor:
                cursor.execute(
                    f'CREATE TABLE "{RANGE_TABLE}_default" PARTITION OF "{RANGE_TABLE}" DEFAULT'
                )
            result = invoke("expire", "--table", RANGE_TABLE)
        assert result.exit_code == 1
        assert result.exception is not None
        assert isinstance(result.exception, SystemExit)
        assert result.output.startswith(
            f"Error: {RANGE_TABLE}_default is a default partition of {RANGE_TABLE}."
        )
