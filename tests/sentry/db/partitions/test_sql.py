import re
from datetime import UTC, datetime, timedelta, timezone

import pytest

from sentry.db.partitions import sql


def find_postgres_14_incompatibilities(statement: str) -> list[str]:
    return [
        pattern
        for pattern in sql.POSTGRES_14_INCOMPATIBLE
        if re.search(pattern, statement, re.IGNORECASE)
    ]


def test_templates_are_postgres_14_compatible() -> None:
    templates = {
        name: value
        for name, value in vars(sql).items()
        if name.isupper() and isinstance(value, str)
    }
    assert templates
    assert {
        name: find_postgres_14_incompatibilities(template)
        for name, template in templates.items()
        if find_postgres_14_incompatibilities(template)
    } == {}


@pytest.mark.parametrize(
    "statement",
    [
        "CREATE UNIQUE INDEX x ON t (a) NULLS NOT DISTINCT",
        "MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN DELETE",
        "ALTER TABLE t ADD CONSTRAINT c NOT NULL a NOT VALID",
        "ALTER TABLE t SPLIT PARTITION p INTO (PARTITION a, PARTITION b)",
        "ALTER TABLE t ADD CONSTRAINT c EXCLUDE USING gist (a WITH &&)",
    ],
)
def test_incompatible_statements_are_detected(statement: str) -> None:
    assert find_postgres_14_incompatibilities(statement)


def test_timestamp_literal() -> None:
    value = datetime(2024, 3, 4, 2, tzinfo=timezone(timedelta(hours=2)))
    assert sql.timestamp_literal(value) == "'2024-03-04 00:00:00+00:00'"
    assert sql.timestamp_literal(datetime(2024, 3, 4, tzinfo=UTC)) == "'2024-03-04 00:00:00+00:00'"


def test_timestamp_literal_rejects_naive_datetimes() -> None:
    with pytest.raises(ValueError):
        sql.timestamp_literal(datetime(2024, 3, 4))
