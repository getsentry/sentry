from datetime import UTC, datetime, timedelta, timezone

import pytest

from sentry.db.partitions.spec import (
    MAX_IDENTIFIER_LENGTH,
    PartitionInterval,
    RangePartitioning,
    hash_partition_bounds,
    hash_partition_name,
    parse_range_partition_name,
    premade_range_partition_bounds,
    range_partition_bounds,
    range_partition_name,
)


def test_floor_day() -> None:
    value = datetime(2024, 3, 7, 15, 30, tzinfo=UTC)
    assert PartitionInterval.DAY.floor(value) == datetime(2024, 3, 7, tzinfo=UTC)


def test_floor_week_starts_on_monday() -> None:
    # 2024-03-10 is a Sunday.
    value = datetime(2024, 3, 10, 23, 59, tzinfo=UTC)
    assert PartitionInterval.WEEK.floor(value) == datetime(2024, 3, 4, tzinfo=UTC)


def test_floor_month() -> None:
    value = datetime(2024, 3, 31, 12, tzinfo=UTC)
    assert PartitionInterval.MONTH.floor(value) == datetime(2024, 3, 1, tzinfo=UTC)


def test_floor_converts_to_utc() -> None:
    value = datetime(2024, 3, 1, 1, tzinfo=timezone(timedelta(hours=2)))
    assert PartitionInterval.DAY.floor(value) == datetime(2024, 2, 29, tzinfo=UTC)


def test_floor_rejects_naive_datetimes() -> None:
    with pytest.raises(ValueError):
        PartitionInterval.DAY.floor(datetime(2024, 3, 1))


def test_advance() -> None:
    start = datetime(2024, 11, 1, tzinfo=UTC)
    assert PartitionInterval.DAY.advance(start, 3) == datetime(2024, 11, 4, tzinfo=UTC)
    assert PartitionInterval.WEEK.advance(start, 2) == datetime(2024, 11, 15, tzinfo=UTC)
    assert PartitionInterval.MONTH.advance(start, 2) == datetime(2025, 1, 1, tzinfo=UTC)
    assert PartitionInterval.MONTH.advance(start, 14) == datetime(2026, 1, 1, tzinfo=UTC)


def test_range_partition_bounds_cover_the_range() -> None:
    bounds = range_partition_bounds(
        "sentry_table",
        PartitionInterval.MONTH,
        datetime(2024, 11, 15, tzinfo=UTC),
        datetime(2025, 1, 2, tzinfo=UTC),
    )
    assert [(b.name, b.start, b.end) for b in bounds] == [
        (
            "sentry_table_p20241101",
            datetime(2024, 11, 1, tzinfo=UTC),
            datetime(2024, 12, 1, tzinfo=UTC),
        ),
        (
            "sentry_table_p20241201",
            datetime(2024, 12, 1, tzinfo=UTC),
            datetime(2025, 1, 1, tzinfo=UTC),
        ),
        (
            "sentry_table_p20250101",
            datetime(2025, 1, 1, tzinfo=UTC),
            datetime(2025, 2, 1, tzinfo=UTC),
        ),
    ]


def test_premade_range_partition_bounds() -> None:
    spec = RangePartitioning("date_added", PartitionInterval.DAY, premake=2)
    bounds = premade_range_partition_bounds("t", spec, datetime(2024, 3, 7, 12, tzinfo=UTC))
    assert [b.name for b in bounds] == ["t_p20240307", "t_p20240308", "t_p20240309"]


def test_hash_partition_bounds() -> None:
    bounds = hash_partition_bounds("t", 3)
    assert [(b.name, b.modulus, b.remainder) for b in bounds] == [
        ("t_h00", 3, 0),
        ("t_h01", 3, 1),
        ("t_h02", 3, 2),
    ]
    assert hash_partition_name("t", 128, 7) == "t_h007"


def test_long_names_are_truncated_and_stay_unique() -> None:
    table = "sentry_" + "x" * 80
    first = range_partition_name(table, datetime(2024, 3, 4, tzinfo=UTC))
    second = range_partition_name(table, datetime(2024, 3, 11, tzinfo=UTC))
    assert len(first) == MAX_IDENTIFIER_LENGTH
    assert first.endswith("_p20240304")
    assert second.endswith("_p20240311")
    assert len(hash_partition_name(table, 4, 1)) == MAX_IDENTIFIER_LENGTH


def test_parse_range_partition_name() -> None:
    assert parse_range_partition_name("t", "t_p20240304") == datetime(2024, 3, 4, tzinfo=UTC)
    assert parse_range_partition_name("t", "t_p20241399") is None
    assert parse_range_partition_name("t", "t_h01") is None
    assert parse_range_partition_name("t", "other_p20240304") is None
    assert parse_range_partition_name("t", "t_x_p20240304") is None

    table = "sentry_" + "x" * 80
    start = datetime(2024, 3, 4, tzinfo=UTC)
    assert parse_range_partition_name(table, range_partition_name(table, start)) == start
