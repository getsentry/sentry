"""
Declarations for Postgres table partitioning.

A model opts in by setting ``__partitioning__`` to a ``RangePartitioning`` or
``HashPartitioning``. The declaration is fixed in code and describes the shape the
table has *when it is partitioned*. Only new models can declare it: their migration
creates the table with ``CreatePartitionedModel``, which records the declaration.
Whether a table is actually partitioned in a given environment is controlled by
``settings.SENTRY_PARTITIONED_TABLES``.
"""

from __future__ import annotations

import enum
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from django.db.backends.utils import truncate_name

# Postgres truncates identifiers longer than NAMEDATALEN - 1 bytes.
MAX_IDENTIFIER_LENGTH = 63
MAX_HASH_MODULUS = 1024


class PartitionInterval(enum.StrEnum):
    """Width of a range partition. All boundaries are in UTC."""

    DAY = "day"
    # Weeks start on Monday.
    WEEK = "week"
    MONTH = "month"

    def floor(self, value: datetime) -> datetime:
        """Start of the interval containing ``value``."""
        if value.tzinfo is None:
            raise ValueError("Partition boundaries require timezone-aware datetimes.")
        start = value.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        if self is PartitionInterval.WEEK:
            return start - timedelta(days=start.weekday())
        if self is PartitionInterval.MONTH:
            return start.replace(day=1)
        return start

    def advance(self, start: datetime, steps: int = 1) -> datetime:
        """Move an interval-aligned ``start`` forward by ``steps`` intervals."""
        if self is PartitionInterval.DAY:
            return start + timedelta(days=steps)
        if self is PartitionInterval.WEEK:
            return start + timedelta(weeks=steps)
        month_index = start.year * 12 + (start.month - 1) + steps
        return start.replace(year=month_index // 12, month=month_index % 12 + 1)


@dataclass(frozen=True)
class RangePartitioning:
    """
    Partition by ranges of a timezone-aware datetime field.

    ``premake`` is how many partitions after the current one are kept created ahead
    of time. ``retention`` is how long partitions are kept before the partition
    maintenance task drops them. ``None`` means partitions are never dropped
    automatically.

    Example::

        from datetime import timedelta

        from django.db import models
        from django.utils import timezone

        from sentry.backup.scopes import RelocationScope
        from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
        from sentry.db.partitions import PartitionInterval, RangePartitioning


        @cell_silo_model
        class ExampleCheckIn(Model):
            __relocation_scope__ = RelocationScope.Excluded
            # One partition per week, four weeks created ahead of time, partitions
            # dropped once all of their rows are older than 90 days.
            __partitioning__ = RangePartitioning(
                "date_added",
                PartitionInterval.WEEK,
                premake=4,
                retention=timedelta(days=90),
            )

            # The partition field must be a non-nullable DateTimeField.
            date_added = models.DateTimeField(default=timezone.now)
            # Range partitioned tables can't have database foreign keys: attaching or
            # dropping a partition would lock the referenced table.
            project = FlexibleForeignKey("sentry.Project", db_constraint=False)
            # Uniqueness can only be enforced together with the partition field,
            # so `guid` can't be `unique=True` on its own.
            guid = models.UUIDField()
            status = models.PositiveSmallIntegerField(default=0)

            class Meta:
                app_label = "sentry"
                db_table = "sentry_examplecheckin"
                indexes = [models.Index(fields=["project", "date_added"])]
                constraints = [
                    models.UniqueConstraint(
                        fields=["guid", "date_added"],
                        name="sentry_examplecheckin_guid_date_added_uniq",
                    )
                ]

    In Postgres the primary key becomes ``(id, date_added)``, while Django keeps
    ``id`` as the primary key. Database foreign keys aren't allowed in either
    direction: other models reference a range partitioned model with a plain id
    column or a ``FlexibleForeignKey(..., db_constraint=False)``, and so does the
    model itself. Queries should filter on
    ``date_added`` (or ``id``), otherwise they scan every partition.

    Two consequences to plan for before partitioning a table:

    - ``id`` alone is no longer unique in the database, only ``(id, date_added)``
      is. ``id`` still comes from one sequence, so duplicates only appear if ids are
      set explicitly.
    - Partitions only exist from the time the table is created, plus ``premake``
      intervals ahead. A row dated before the oldest partition, e.g. a backdated or
      backfilled one, fails to insert. Nothing creates older partitions yet:
      ``ensure`` only creates the current one and the ones ahead.

    The model's migration creates its table with ``CreatePartitionedModel``, passing
    the same declaration as ``partitioning``, instead of the generated ``CreateModel``.
    The table is only created partitioned in environments that list
    ``sentry_examplecheckin`` in ``SENTRY_PARTITIONED_TABLES``.
    """

    field: str
    interval: PartitionInterval
    premake: int = 4
    retention: timedelta | None = None

    method: ClassVar[str] = "RANGE"

    def layout(self) -> tuple[object, ...]:
        """What shapes the table. ``premake`` and ``retention`` can change later."""
        return (self.method, self.field, self.interval)

    def deconstruct(self) -> tuple[str, list[object], dict[str, object]]:
        kwargs: dict[str, object] = {"premake": self.premake, "retention": self.retention}
        return "sentry.db.partitions.RangePartitioning", [self.field, self.interval], kwargs


@dataclass(frozen=True)
class HashPartitioning:
    """
    Partition by the hash of an integer field into ``modulus`` partitions.

    All partitions are created together with the table, and the number of partitions
    can't change afterwards.

    Example::

        from django.db import models

        from sentry.backup.scopes import RelocationScope
        from sentry.db.models import FlexibleForeignKey, Model, cell_silo_model
        from sentry.db.partitions import HashPartitioning


        @cell_silo_model
        class ExampleIssue(Model):
            __relocation_scope__ = RelocationScope.Excluded
            # Rows are spread over 16 partitions by the hash of their id.
            __partitioning__ = HashPartitioning("id", modulus=16)

            # Database foreign keys from a hash partitioned table are fine: its
            # partitions are created with the table and never attached or dropped.
            project = FlexibleForeignKey("sentry.Project")
            # Uniqueness can only be enforced together with the partition field,
            # so `(project, short_id)` can't be unique on its own.
            short_id = models.BigIntegerField()
            title = models.TextField()

            class Meta:
                app_label = "sentry"
                db_table = "sentry_exampleissue"
                indexes = [models.Index(fields=["project", "short_id"])]


        @cell_silo_model
        class ExampleIssueComment(Model):
            __relocation_scope__ = RelocationScope.Excluded

            # Allowed: the referenced table is hash partitioned on its primary key.
            issue = FlexibleForeignKey(ExampleIssue)
            text = models.TextField()

            class Meta:
                app_label = "sentry"
                db_table = "sentry_exampleissuecomment"

    Partitioning on ``id`` keeps the Postgres primary key as just ``id``, which is
    what lets other tables keep database foreign keys to it. Hash partitioning on
    any other field, for example ``HashPartitioning("project", modulus=16)``, makes
    the primary key ``(id, project_id)`` and rules out foreign keys into the table,
    like range partitioning does. Hash partitions are never dropped automatically.

    The model's migration creates its table with ``CreatePartitionedModel``, passing
    the same declaration as ``partitioning``, instead of the generated ``CreateModel``.
    The table is only created partitioned in environments that list
    ``sentry_exampleissue`` in ``SENTRY_PARTITIONED_TABLES``.
    """

    field: str
    modulus: int

    method: ClassVar[str] = "HASH"

    def layout(self) -> tuple[object, ...]:
        """What shapes the table."""
        return (self.method, self.field, self.modulus)

    def deconstruct(self) -> tuple[str, list[object], dict[str, object]]:
        return "sentry.db.partitions.HashPartitioning", [self.field], {"modulus": self.modulus}


PartitioningSpec = RangePartitioning | HashPartitioning


@dataclass(frozen=True)
class RangePartitionBound:
    name: str
    start: datetime
    end: datetime


@dataclass(frozen=True)
class HashPartitionBound:
    name: str
    modulus: int
    remainder: int


def _with_suffix(table: str, suffix: str) -> str:
    return truncate_name(table, MAX_IDENTIFIER_LENGTH - len(suffix)) + suffix


_RANGE_SUFFIX_LENGTH = len("_pYYYYMMDD")


def range_partition_name(table: str, start: datetime) -> str:
    return _with_suffix(table, f"_p{start.astimezone(UTC):%Y%m%d}")


def range_partition_prefix(table: str) -> str:
    """What every range partition name of ``table`` starts with, before ``_pYYYYMMDD``."""
    return truncate_name(table, MAX_IDENTIFIER_LENGTH - _RANGE_SUFFIX_LENGTH)


def parse_range_partition_name(table: str, name: str) -> datetime | None:
    """The start of the range partition of ``table`` called ``name``, if it is one."""
    prefix = range_partition_prefix(table)
    match = re.fullmatch(re.escape(prefix) + r"_p(\d{8})", name)
    if match is None:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%d").replace(tzinfo=UTC)
    except ValueError:
        return None


def hash_partition_name(table: str, modulus: int, remainder: int) -> str:
    width = max(2, len(str(modulus - 1)))
    return _with_suffix(table, f"_h{remainder:0{width}d}")


def range_partition_bounds(
    table: str, interval: PartitionInterval, start: datetime, end: datetime
) -> list[RangePartitionBound]:
    """Partitions covering ``[start, end)``, aligned to ``interval``."""
    bounds = []
    current = interval.floor(start)
    while current < end:
        upper = interval.advance(current)
        bounds.append(RangePartitionBound(range_partition_name(table, current), current, upper))
        current = upper
    return bounds


def premade_range_partition_bounds(
    table: str, spec: RangePartitioning, now: datetime
) -> list[RangePartitionBound]:
    """The partition containing ``now`` plus ``spec.premake`` partitions after it."""
    start = spec.interval.floor(now)
    return range_partition_bounds(
        table, spec.interval, start, spec.interval.advance(start, spec.premake + 1)
    )


def hash_partition_bounds(table: str, modulus: int) -> list[HashPartitionBound]:
    return [
        HashPartitionBound(hash_partition_name(table, modulus, remainder), modulus, remainder)
        for remainder in range(modulus)
    ]
