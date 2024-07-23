from unittest.mock import Mock, patch

from sentry.db.postgres.lookups.array_element_contains import ArrayElementContainsLookup


def test_as_sql_basic_usage():
    with (
        patch(
            "sentry.db.postgres.lookups.array_element_contains.ArrayElementContainsLookup.process_lhs"
        ) as mock_process_lhs,
        patch(
            "sentry.db.postgres.lookups.array_element_contains.ArrayElementContainsLookup.process_rhs"
        ) as mock_process_rhs,
    ):
        lhs = "column_name"
        rhs = "%s"
        mock_process_lhs.return_value = (lhs, [])
        mock_process_rhs.return_value = (rhs, ["value"])

        lookup = ArrayElementContainsLookup(lhs, rhs)
        sql, params = lookup.as_sql(Mock(), Mock())

        assert (
            sql
            == """EXISTS (
            SELECT * FROM UNNEST(column_name) AS elem
            WHERE elem LIKE '%%' || %s || '%%'
        )"""
        )
        assert params == ["value"]
