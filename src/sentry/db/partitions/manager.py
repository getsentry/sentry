"""
Creating and dropping range partitions on live tables.

Everything here reads the database catalog and does nothing for tables that are not
partitioned, so it is safe to run in every environment.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from django.db import models, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.backends.utils import truncate_name
from django.utils import timezone

from sentry.db.partitions import sql
from sentry.db.partitions.catalog import (
    PartitionInfo,
    get_connection,
    get_partitioned_table_info,
    list_detached_range_partitions,
    list_partitions,
)
from sentry.db.partitions.registry import (
    get_partition_column,
    iter_partitioned_models,
    resolve_partitioning,
)
from sentry.db.partitions.spec import (
    MAX_IDENTIFIER_LENGTH,
    RangePartitionBound,
    RangePartitioning,
    premade_range_partition_bounds,
)
from sentry.silo.base import SiloLimit
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RangeTable:
    """A range partitioned table, resolved from a live or historical model."""

    connection: BaseDatabaseWrapper
    table: str
    column: str
    spec: RangePartitioning


def get_range_table(
    model: type[models.Model], connection: BaseDatabaseWrapper | None = None
) -> RangeTable | None:
    """``None`` unless ``model`` declares range partitioning and its table is partitioned."""
    spec = resolve_partitioning(model)
    if not isinstance(spec, RangePartitioning):
        return None
    connection = connection if connection is not None else get_connection(model)
    table = model._meta.db_table
    info = get_partitioned_table_info(connection, table)
    if info is None or info.strategy != "range":
        return None
    return RangeTable(connection, table, get_partition_column(model, spec), spec)


class DefaultPartitionError(Exception):
    pass


def _range_partitions(target: RangeTable) -> list[PartitionInfo]:
    """
    The partitions of ``target``, refusing tables with a default partition.

    Postgres can't detach a partition concurrently while the table has a default
    partition, and attaching one has to scan the default partition for rows that
    belong in it. A default partition is likely added by hand after inserts failed
    with "no partition of relation found for row", so this explains what to do.
    """
    partitions = list_partitions(target.connection, target.table)
    for partition in partitions:
        if partition.is_default:
            raise DefaultPartitionError(
                f"{target.table} has a default partition, {partition.name}, which partition "
                f"maintenance doesn't support: partitions can't be detached concurrently "
                f"while it exists. Move its rows into regular partitions, created with "
                f"`sentry partitions ensure`, and drop it."
            )
    return partitions


def _quote(connection: BaseDatabaseWrapper, name: str) -> str:
    return connection.ops.quote_name(name)


def _attach_range_partition(target: RangeTable, bound: RangePartitionBound) -> None:
    quote = target.connection.ops.quote_name
    check_name = truncate_name(f"{bound.name}_bound", MAX_IDENTIFIER_LENGTH)
    values = {
        "table": quote(target.table),
        "partition": quote(bound.name),
        "column": quote(target.column),
        "name": quote(check_name),
        "start": sql.timestamp_literal(bound.start),
        "end": sql.timestamp_literal(bound.end),
    }
    with transaction.atomic(using=target.connection.alias):
        with target.connection.cursor() as cursor:
            cursor.execute(sql.SET_LOCAL_LOCK_TIMEOUT.format(timeout=sql.DEFAULT_LOCK_TIMEOUT))
            cursor.execute(sql.CREATE_STANDALONE_PARTITION.format(**values))
            cursor.execute(sql.ADD_RANGE_BOUND_CHECK.format(**values))
            cursor.execute(sql.ATTACH_RANGE_PARTITION.format(**values))
            cursor.execute(
                sql.DROP_CONSTRAINT.format(table=values["partition"], name=values["name"])
            )


def _overlaps(bound: RangePartitionBound, start: datetime | None, end: datetime | None) -> bool:
    return (start is None or start < bound.end) and (end is None or bound.start < end)


def ensure_range_partitions(target: RangeTable, now: datetime | None = None) -> list[str]:
    """
    Create the partition containing ``now`` and ``premake`` partitions after it.

    Partitions are created as standalone tables and attached, so the parent table
    only takes a SHARE UPDATE EXCLUSIVE lock. Range partitioned tables have no
    database foreign keys, so no other table is locked. Returns the names of the new
    partitions.
    """
    now = now if now is not None else timezone.now()
    existing = _range_partitions(target)
    existing_names = {p.name for p in existing}
    existing_ranges = [p.range_bounds() for p in existing]

    created = []
    for bound in premade_range_partition_bounds(target.table, target.spec, now):
        if bound.name in existing_names:
            continue
        if any(_overlaps(bound, start, end) for start, end in existing_ranges):
            # A partition we didn't name already covers part of this range.
            logger.warning(
                "partitions.ensure.overlap",
                extra={"table": target.table, "partition": bound.name},
            )
            continue
        _attach_range_partition(target, bound)
        created.append(bound.name)
        logger.info(
            "partitions.ensure.created", extra={"table": target.table, "partition": bound.name}
        )

    metrics.incr("db.partitions.created", amount=len(created), tags={"table": target.table})
    return created


def _execute_ddl(
    connection: BaseDatabaseWrapper, statement: str, *, concurrently: bool = False
) -> None:
    """
    Run ``statement`` with a lock timeout.

    Statements run in their own transaction with ``SET LOCAL``, so the timeout can't
    outlive them, even through a pooler that hands each transaction a different
    server connection. ``DETACH ... CONCURRENTLY`` can't run in a transaction, so it
    sets the timeout for the session and resets it right after. Through a pooler in
    transaction mode those three statements could run on different server
    connections, so the task should connect to Postgres directly or through session
    pooling.
    """
    if not concurrently:
        with transaction.atomic(using=connection.alias), connection.cursor() as cursor:
            cursor.execute(sql.SET_LOCAL_LOCK_TIMEOUT.format(timeout=sql.DEFAULT_LOCK_TIMEOUT))
            cursor.execute(statement)
        return
    with connection.cursor() as cursor:
        cursor.execute(sql.SET_LOCK_TIMEOUT.format(timeout=sql.DEFAULT_LOCK_TIMEOUT))
        try:
            cursor.execute(statement)
        finally:
            cursor.execute(sql.RESET_LOCK_TIMEOUT)


def expire_range_partitions(
    target: RangeTable, before: datetime, now: datetime | None = None, dry_run: bool = False
) -> list[str]:
    """
    Drop every partition that only holds rows older than ``before``.

    Each expired partition is marked with a table comment, detached concurrently and
    then dropped.

    - A detach that was interrupted earlier, e.g. by the lock timeout, is finished
      first with FINALIZE, because it blocks every other concurrent detach on the
      table. If that partition isn't expired anymore, e.g. because retention was
      raised since, it is kept without the mark, like a partition detached by hand.
    - A partition this detached but failed to drop, e.g. because the drop timed out,
      is no longer attached to the table. It is found by its name and its mark, and
      dropped if it is still older than ``before``.
    - Partitions detached any other way, e.g. by hand to keep their data, don't have
      the mark and are never dropped.
    - An attached partition that carries the mark but isn't expired anymore has the
      mark removed, so detaching it by hand later keeps it.

    Returns the names of the dropped partitions, or of the partitions that would be
    dropped with ``dry_run``.
    """
    now = now if now is not None else timezone.now()
    if before > now:
        raise ValueError(f"Refusing to drop partitions of {target.table} newer than now.")
    if target.connection.in_atomic_block and not dry_run:
        raise RuntimeError("Partitions can't be detached concurrently inside a transaction.")

    expired = []
    table = _quote(target.connection, target.table)

    def is_expired(start: datetime) -> bool:
        return target.spec.interval.advance(start) <= before

    def drop(partition: str, detach: str, concurrently: bool) -> None:
        name = _quote(target.connection, partition)
        # Lets a later run tell this partition apart from ones detached by hand, if
        # the drop below fails.
        _execute_ddl(target.connection, sql.MARK_PARTITION_EXPIRING.format(partition=name))
        _execute_ddl(
            target.connection,
            detach.format(table=table, partition=name),
            concurrently=concurrently,
        )
        _execute_ddl(target.connection, sql.DROP_TABLE.format(table=name))
        logger.info(
            "partitions.expire.dropped", extra={"table": target.table, "partition": partition}
        )

    partitions = _range_partitions(target)

    # While one partition's detach is pending, Postgres refuses to detach any other
    # partition of the table concurrently, so pending detaches are finished first,
    # whether or not the partition is still expired.
    for partition in partitions:
        if not partition.detach_pending:
            continue
        _, end = partition.range_bounds()
        if end is not None and end <= before:
            expired.append(partition.name)
            if not dry_run:
                drop(partition.name, sql.FINALIZE_DETACH_PARTITION, concurrently=False)
            continue
        if dry_run:
            continue
        # Not expired anymore, e.g. because retention was raised since. Finished
        # without the mark, it counts as detached by hand: it's kept and reported.
        name = _quote(target.connection, partition.name)
        if partition.expiring:
            _execute_ddl(target.connection, sql.UNMARK_PARTITION_EXPIRING.format(partition=name))
        _execute_ddl(
            target.connection, sql.FINALIZE_DETACH_PARTITION.format(table=table, partition=name)
        )
        logger.warning(
            "partitions.expire.kept_unexpired_detach",
            extra={"table": target.table, "partition": partition.name},
        )

    for detached in list_detached_range_partitions(target.connection, target.table):
        # The mark alone never decides a drop, it could be stale.
        if not detached.expiring or not is_expired(detached.start):
            continue
        expired.append(detached.name)
        if dry_run:
            continue
        _execute_ddl(
            target.connection,
            sql.DROP_TABLE.format(table=_quote(target.connection, detached.name)),
        )
        logger.info(
            "partitions.expire.dropped_detached",
            extra={"table": target.table, "partition": detached.name},
        )

    for partition in partitions:
        if partition.detach_pending:
            continue
        _, end = partition.range_bounds()
        if end is None or end > before:
            if partition.expiring and not dry_run:
                _execute_ddl(
                    target.connection,
                    sql.UNMARK_PARTITION_EXPIRING.format(
                        partition=_quote(target.connection, partition.name)
                    ),
                )
                logger.info(
                    "partitions.expire.unmarked",
                    extra={"table": target.table, "partition": partition.name},
                )
            continue
        expired.append(partition.name)
        if not dry_run:
            drop(partition.name, sql.DETACH_PARTITION_CONCURRENTLY, concurrently=True)

    if not dry_run:
        metrics.incr("db.partitions.dropped", amount=len(expired), tags={"table": target.table})
    return expired


def ensure_partitions(model: type[models.Model], now: datetime | None = None) -> list[str]:
    target = get_range_table(model)
    if target is None:
        return []
    return ensure_range_partitions(target, now=now)


def expire_partitions(
    model: type[models.Model],
    before: datetime | None = None,
    now: datetime | None = None,
    dry_run: bool = False,
) -> list[str]:
    """
    Drop partitions older than ``before``, defaulting to the declared ``retention``.

    Does nothing when neither is set.
    """
    target = get_range_table(model)
    if target is None:
        return []
    now = now if now is not None else timezone.now()
    if before is None:
        if target.spec.retention is None:
            return []
        before = now - target.spec.retention
    return expire_range_partitions(target, before, now=now, dry_run=dry_run)


def report_partition_metrics(target: RangeTable, now: datetime) -> None:
    """
    Gauges for alerting, reported on every run, including zeros:

    - ``db.partitions.ahead``: partitions after the current one. Inserts fail once
      no partition covers them.
    - ``db.partitions.detached_by_hand``: partitions detached by hand, which are kept
      until someone drops them, e.g. after an incident or a legal hold ends.
    - ``db.partitions.detached_drop_failed``: partitions expiry detached but failed to
      drop. The next run retries.
    """
    tags = {"table": target.table}
    ahead = sum(
        1
        for partition in list_partitions(target.connection, target.table)
        if not partition.is_default
        and (start := partition.range_bounds()[0]) is not None
        and start > now
    )
    metrics.gauge("db.partitions.ahead", ahead, tags=tags)
    detached = list_detached_range_partitions(target.connection, target.table)
    by_hand = [partition.name for partition in detached if not partition.expiring]
    metrics.gauge("db.partitions.detached_by_hand", len(by_hand), tags=tags)
    metrics.gauge("db.partitions.detached_drop_failed", len(detached) - len(by_hand), tags=tags)
    if by_hand:
        logger.info(
            "partitions.detached_by_hand", extra={"table": target.table, "partitions": by_hand}
        )


def _report_failure(table: str, step: str) -> None:
    logger.exception("partitions.maintenance.failed", extra={"table": table, "step": step})
    metrics.incr("db.partitions.maintenance.error", tags={"table": table, "step": step})


def maintain_partitions() -> None:
    """
    Create upcoming partitions and drop expired ones for every range partitioned table.

    Each step runs on its own, so one that keeps failing, e.g. creating a partition
    whose name is taken, doesn't stop the others.
    """
    for model, spec in iter_partitioned_models():
        if not isinstance(spec, RangePartitioning):
            continue
        silo_limit = getattr(model._meta, "silo_limit", None)
        if isinstance(silo_limit, SiloLimit) and not silo_limit.is_available():
            continue
        table = model._meta.db_table
        try:
            target = get_range_table(model)
        except Exception:
            _report_failure(table, "inspect")
            continue
        if target is None:
            continue
        now = timezone.now()
        try:
            ensure_range_partitions(target, now=now)
        except Exception:
            _report_failure(table, "ensure")
        if spec.retention is not None:
            try:
                expire_range_partitions(target, now - spec.retention, now=now)
            except Exception:
                _report_failure(table, "expire")
        # Reported even when maintenance failed, which is when they matter most.
        try:
            report_partition_metrics(target, now)
        except Exception:
            _report_failure(table, "metrics")
