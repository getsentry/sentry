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
    get_connection,
    get_partitioned_table_info,
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
    only takes a SHARE UPDATE EXCLUSIVE lock. Returns the names of the new partitions.
    """
    now = now if now is not None else timezone.now()
    existing = list_partitions(target.connection, target.table)
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


def _execute_outside_transaction(connection: BaseDatabaseWrapper, statement: str) -> None:
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

    Partitions are detached concurrently and then dropped. A detach of an expired
    partition that was interrupted earlier is finished with FINALIZE. Returns the names of the dropped
    partitions, or of the partitions that would be dropped with ``dry_run``.
    """
    now = now if now is not None else timezone.now()
    if before > now:
        raise ValueError(f"Refusing to drop partitions of {target.table} newer than now.")
    if target.connection.in_atomic_block and not dry_run:
        raise RuntimeError("Partitions can't be detached concurrently inside a transaction.")

    expired = []
    for partition in list_partitions(target.connection, target.table):
        _, end = partition.range_bounds()
        if end is None or end > before:
            continue
        expired.append(partition.name)
        if dry_run:
            continue
        table = _quote(target.connection, target.table)
        name = _quote(target.connection, partition.name)
        template = (
            sql.FINALIZE_DETACH_PARTITION
            if partition.detach_pending
            else sql.DETACH_PARTITION_CONCURRENTLY
        )
        _execute_outside_transaction(
            target.connection, template.format(table=table, partition=name)
        )
        _execute_outside_transaction(target.connection, sql.DROP_TABLE.format(table=name))
        logger.info(
            "partitions.expire.dropped",
            extra={"table": target.table, "partition": partition.name},
        )

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


def drop_partitions_for_cleanup(
    model: type[models.Model], dtfield: str, before: datetime
) -> list[str]:
    """
    Used by ``sentry cleanup`` before it deletes old rows one by one.

    Partitions are only dropped when cleanup deletes by the partition field, so this
    never removes rows cleanup wouldn't have deleted.
    """
    target = get_range_table(model)
    if target is None:
        return []
    field = model._meta.get_field(dtfield)
    if not isinstance(field, models.Field) or field.column != target.column:
        return []
    return expire_range_partitions(target, before)


def maintain_partitions() -> None:
    """Create upcoming partitions and drop expired ones for every range partitioned table."""
    for model, spec in iter_partitioned_models():
        if not isinstance(spec, RangePartitioning):
            continue
        silo_limit = getattr(model._meta, "silo_limit", None)
        if isinstance(silo_limit, SiloLimit) and not silo_limit.is_available():
            continue
        table = model._meta.db_table
        try:
            target = get_range_table(model)
            if target is None:
                continue
            now = timezone.now()
            ensure_range_partitions(target, now=now)
            if spec.retention is not None:
                expire_range_partitions(target, now - spec.retention, now=now)
            ahead = sum(
                1
                for partition in list_partitions(target.connection, table)
                if (start := partition.range_bounds()[0]) is not None and start > now
            )
            metrics.gauge("db.partitions.ahead", ahead, tags={"table": table})
        except Exception:
            logger.exception("partitions.maintenance.failed", extra={"table": table})
            metrics.incr("db.partitions.maintenance.error", tags={"table": table})
