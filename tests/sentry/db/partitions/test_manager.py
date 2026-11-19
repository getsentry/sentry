from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
from django.db import OperationalError, connection, transaction
from django.db.backends.base.base import BaseDatabaseWrapper

from fixtures.partitions import (
    HashPartitionedFixture,
    RangePartitionedFixture,
    fixture_tables,
)
from sentry.db.partitions import manager, sql
from sentry.db.partitions.catalog import (
    DetachedPartition,
    PartitionInfo,
    list_detached_range_partitions,
    list_partitions,
)
from sentry.db.partitions.manager import (
    RangeTable,
    ensure_partitions,
    expire_partitions,
    get_range_table,
    maintain_partitions,
)
from sentry.db.partitions.spec import RangePartitionBound
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import freeze_time

RANGE_TABLE = RangePartitionedFixture._meta.db_table
# A Wednesday. Tables are created with the weeks of 03-04, 03-11 and 03-18.
CREATED_AT = datetime(2024, 3, 6, 12, tzinfo=UTC)


def partition_names() -> list[str]:
    return [p.name for p in list_partitions(connection, RANGE_TABLE)]


def week(day: int) -> str:
    return f"{RANGE_TABLE}_p202403{day:02d}"


def locked_tables() -> list[str]:
    """User tables this connection holds a lock on."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT c.relname
            FROM pg_locks AS l
            JOIN pg_class AS c ON c.oid = l.relation
            JOIN pg_namespace AS n ON n.oid = c.relnamespace
            WHERE l.pid = pg_backend_pid()
                AND c.relkind IN ('r', 'p')
                AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY c.relname
            """
        )
        return [row[0] for row in cursor.fetchall()]


def detach(partition: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(f'ALTER TABLE "{RANGE_TABLE}" DETACH PARTITION "{partition}"')


class EnsurePartitionsTest(TransactionTestCase):
    @freeze_time(CREATED_AT)
    def test_creates_upcoming_partitions(self) -> None:
        with fixture_tables():
            later = CREATED_AT + timedelta(weeks=2)
            assert ensure_partitions(RangePartitionedFixture, now=later) == [
                week(25),
                f"{RANGE_TABLE}_p20240401",
            ]
            assert ensure_partitions(RangePartitionedFixture, now=later) == []
            assert partition_names() == [
                week(4),
                week(11),
                week(18),
                week(25),
                f"{RANGE_TABLE}_p20240401",
            ]

    @freeze_time(CREATED_AT)
    def test_attaching_only_locks_the_table_and_the_new_partition(self) -> None:
        with fixture_tables():
            locked: list[str] = []
            attach = manager._attach_range_partition

            def attach_and_record_locks(target: RangeTable, bound: RangePartitionBound) -> None:
                # Hold the locks until after they are recorded.
                with transaction.atomic(using="default"):
                    attach(target, bound)
                    locked.extend(locked_tables())

            with mock.patch.object(
                manager, "_attach_range_partition", side_effect=attach_and_record_locks
            ):
                ensure_partitions(RangePartitionedFixture, now=CREATED_AT + timedelta(weeks=1))
            assert locked == [RANGE_TABLE, week(25)]

    @freeze_time(CREATED_AT)
    def test_new_partitions_get_indexes(self) -> None:
        with fixture_tables():
            ensure_partitions(RangePartitionedFixture, now=CREATED_AT + timedelta(weeks=1))
            with connection.cursor() as cursor:
                index_counts = []
                for table in (RANGE_TABLE, week(25)):
                    cursor.execute(
                        "SELECT count(*) FROM pg_index WHERE indrelid = to_regclass(%s)", [table]
                    )
                    index_counts.append(cursor.fetchone()[0])
                # Primary key, `value` and `parent_id` indexes.
                assert index_counts == [3, 3]
                cursor.execute(
                    "SELECT count(*) FROM pg_constraint WHERE conrelid = to_regclass(%s) "
                    "AND contype = 'c'",
                    [week(25)],
                )
                # The temporary bound check is dropped again.
                assert cursor.fetchone() == (0,)

            parent = HashPartitionedFixture.objects.create(name="p")
            row = RangePartitionedFixture.objects.create(
                date_added=datetime(2024, 3, 26, tzinfo=UTC), parent=parent
            )
            assert RangePartitionedFixture.objects.filter(id=row.id, parent=parent).exists()

    @freeze_time(CREATED_AT)
    def test_skips_ranges_covered_by_other_partitions(self) -> None:
        with fixture_tables():
            with connection.cursor() as cursor:
                cursor.execute(
                    f'CREATE TABLE "{RANGE_TABLE}_manual" PARTITION OF "{RANGE_TABLE}" '
                    "FOR VALUES FROM ('2024-03-25') TO ('2024-03-27')"
                )
            assert (
                ensure_partitions(RangePartitionedFixture, now=CREATED_AT + timedelta(weeks=1))
                == []
            )

    def test_does_nothing_for_unpartitioned_tables(self) -> None:
        with fixture_tables(partitioned=False):
            assert get_range_table(RangePartitionedFixture) is None
            assert ensure_partitions(RangePartitionedFixture) == []
            assert expire_partitions(RangePartitionedFixture) == []

    def test_does_nothing_for_hash_partitioned_tables(self) -> None:
        with fixture_tables():
            assert get_range_table(HashPartitionedFixture) is None
            assert ensure_partitions(HashPartitionedFixture) == []


class ExpirePartitionsTest(TransactionTestCase):
    @freeze_time(CREATED_AT)
    def test_drops_partitions_before_cutoff(self) -> None:
        with fixture_tables():
            for day in (5, 12, 19):
                RangePartitionedFixture.objects.create(
                    date_added=datetime(2024, 3, day, tzinfo=UTC)
                )
            now = datetime(2024, 3, 20, tzinfo=UTC)
            before = datetime(2024, 3, 12, 12, tzinfo=UTC)

            assert expire_partitions(
                RangePartitionedFixture, before=before, now=now, dry_run=True
            ) == [week(4)]
            assert partition_names() == [week(4), week(11), week(18)]

            assert expire_partitions(RangePartitionedFixture, before=before, now=now) == [week(4)]
            assert partition_names() == [week(11), week(18)]
            assert sorted(
                RangePartitionedFixture.objects.values_list("date_added__day", flat=True)
            ) == [12, 19]
            with connection.cursor() as cursor:
                cursor.execute("SELECT to_regclass(%s)", [week(4)])
                assert cursor.fetchone() == (None,)

    @freeze_time(CREATED_AT)
    def test_uses_declared_retention(self) -> None:
        with fixture_tables():
            # Retention is four weeks, so the week of 03-04 expires on 04-08.
            assert (
                expire_partitions(RangePartitionedFixture, now=datetime(2024, 4, 7, tzinfo=UTC))
                == []
            )
            assert expire_partitions(
                RangePartitionedFixture, now=datetime(2024, 4, 8, tzinfo=UTC)
            ) == [week(4)]

    @freeze_time(CREATED_AT)
    def test_refuses_to_drop_future_partitions(self) -> None:
        with fixture_tables():
            with pytest.raises(ValueError):
                expire_partitions(
                    RangePartitionedFixture, before=CREATED_AT + timedelta(days=1), now=CREATED_AT
                )

    @freeze_time(CREATED_AT)
    def test_refuses_to_run_in_a_transaction(self) -> None:
        with fixture_tables():
            with pytest.raises(RuntimeError), transaction.atomic(using="default"):
                expire_partitions(
                    RangePartitionedFixture,
                    before=datetime(2024, 3, 12, tzinfo=UTC),
                    now=datetime(2024, 3, 20, tzinfo=UTC),
                )

    @freeze_time(CREATED_AT)
    def test_dropping_locks_no_other_table(self) -> None:
        with fixture_tables():
            locked: list[str] = []
            execute = manager._execute_outside_transaction

            def execute_and_record_locks(conn: BaseDatabaseWrapper, statement: str) -> None:
                if not statement.startswith("DROP TABLE"):
                    execute(conn, statement)
                    return
                # Hold the locks until after they are recorded. The dropped partition
                # itself no longer shows up.
                with transaction.atomic(using="default"):
                    execute(conn, statement)
                    locked.extend(locked_tables())

            with mock.patch.object(
                manager, "_execute_outside_transaction", side_effect=execute_and_record_locks
            ):
                assert expire_partitions(
                    RangePartitionedFixture,
                    before=datetime(2024, 3, 12, tzinfo=UTC),
                    now=datetime(2024, 3, 20, tzinfo=UTC),
                ) == [week(4)]
            assert locked == []

    @freeze_time(CREATED_AT)
    def test_keeps_partitions_detached_by_hand(self) -> None:
        with fixture_tables():
            # Detaching by hand is how data is kept, e.g. for an incident or a legal
            # hold, so these are never dropped, even past retention.
            detach(week(4))
            detach(week(18))
            for expected in ([week(11)], []):
                assert (
                    expire_partitions(
                        RangePartitionedFixture,
                        before=datetime(2024, 3, 19, tzinfo=UTC),
                        now=datetime(2024, 3, 20, tzinfo=UTC),
                    )
                    == expected
                )
            assert list_detached_range_partitions(connection, RANGE_TABLE) == [
                DetachedPartition(week(4), datetime(2024, 3, 4, tzinfo=UTC), expiring=False),
                DetachedPartition(week(18), datetime(2024, 3, 18, tzinfo=UTC), expiring=False),
            ]

    @freeze_time(CREATED_AT)
    def test_failed_drop_is_retried(self) -> None:
        with fixture_tables():
            execute = manager._execute_outside_transaction
            failed: list[str] = []

            def fail_first_drop(conn: BaseDatabaseWrapper, statement: str) -> None:
                if statement.startswith("DROP TABLE") and not failed:
                    failed.append(statement)
                    raise OperationalError("canceling statement due to lock timeout")
                execute(conn, statement)

            expire = mock.patch.object(
                manager, "_execute_outside_transaction", side_effect=fail_first_drop
            )
            with expire, pytest.raises(OperationalError):
                expire_partitions(
                    RangePartitionedFixture,
                    before=datetime(2024, 3, 12, tzinfo=UTC),
                    now=datetime(2024, 3, 20, tzinfo=UTC),
                )
            # The partition was detached, so it's no longer listed as a partition, but
            # it was marked before that.
            assert week(4) not in partition_names()
            assert list_detached_range_partitions(connection, RANGE_TABLE) == [
                DetachedPartition(week(4), datetime(2024, 3, 4, tzinfo=UTC), expiring=True)
            ]

            assert expire_partitions(
                RangePartitionedFixture,
                before=datetime(2024, 3, 12, tzinfo=UTC),
                now=datetime(2024, 3, 20, tzinfo=UTC),
            ) == [week(4)]
            assert list_detached_range_partitions(connection, RANGE_TABLE) == []

    @freeze_time(CREATED_AT)
    def test_finishes_interrupted_detach(self) -> None:
        with fixture_tables():
            pending = PartitionInfo(
                week(4),
                "FOR VALUES FROM ('2024-03-04 00:00:00+00') TO ('2024-03-11 00:00:00+00')",
                detach_pending=True,
            )
            with (
                mock.patch.object(manager, "list_partitions", return_value=[pending]),
                mock.patch.object(manager, "_execute_outside_transaction") as execute,
            ):
                expire_partitions(
                    RangePartitionedFixture,
                    before=datetime(2024, 3, 12, tzinfo=UTC),
                    now=datetime(2024, 3, 20, tzinfo=UTC),
                )
            assert [c.args[1] for c in execute.call_args_list] == [
                f'COMMENT ON TABLE "{week(4)}" IS '
                "'Expired: dropped by Sentry partition maintenance.'",
                f'ALTER TABLE "{RANGE_TABLE}" DETACH PARTITION "{week(4)}" FINALIZE',
                f'DROP TABLE "{week(4)}"',
            ]


class MaintainPartitionsTest(TransactionTestCase):
    @freeze_time(CREATED_AT)
    def test_creates_and_expires(self) -> None:
        with fixture_tables():
            with freeze_time(datetime(2024, 4, 9, tzinfo=UTC)):
                maintain_partitions()
            # Weeks before 03-11 are past the four week retention, 04-08 is current and
            # two more are premade. Missed weeks in between are not backfilled.
            assert partition_names() == [
                week(11),
                week(18),
                f"{RANGE_TABLE}_p20240408",
                f"{RANGE_TABLE}_p20240415",
                f"{RANGE_TABLE}_p20240422",
            ]

    def test_errors_do_not_propagate(self) -> None:
        with fixture_tables():
            with (
                mock.patch.object(
                    manager, "ensure_range_partitions", side_effect=Exception("boom")
                ),
                mock.patch("sentry.db.partitions.manager.metrics.incr") as incr,
            ):
                maintain_partitions()
            incr.assert_any_call("db.partitions.maintenance.error", tags={"table": RANGE_TABLE})

    def gauges(self) -> dict[str, int]:
        with mock.patch("sentry.db.partitions.manager.metrics.gauge") as gauge:
            maintain_partitions()
        return {
            c.args[0]: c.args[1]
            for c in gauge.call_args_list
            if c.kwargs["tags"] == {"table": RANGE_TABLE}
        }

    @freeze_time(CREATED_AT)
    def test_reports_partitions_detached_by_hand(self) -> None:
        with fixture_tables():
            assert self.gauges() == {
                "db.partitions.ahead": 2,
                "db.partitions.detached_by_hand": 0,
                "db.partitions.detached_drop_failed": 0,
            }
            detach(week(11))
            assert self.gauges() == {
                "db.partitions.ahead": 1,
                "db.partitions.detached_by_hand": 1,
                "db.partitions.detached_drop_failed": 0,
            }

    @freeze_time(CREATED_AT)
    def test_reports_failed_drops(self) -> None:
        with fixture_tables():
            with connection.cursor() as cursor:
                cursor.execute(sql.MARK_PARTITION_EXPIRING.format(partition=f'"{week(18)}"'))
            detach(week(18))
            # Retrying the drop fails again, e.g. on another lock timeout. The gauges are
            # still reported.
            with mock.patch.object(
                manager, "expire_range_partitions", side_effect=OperationalError("lock timeout")
            ):
                assert self.gauges() == {
                    "db.partitions.ahead": 1,
                    "db.partitions.detached_by_hand": 0,
                    "db.partitions.detached_drop_failed": 1,
                }
