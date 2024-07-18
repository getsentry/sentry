from unittest.mock import Mock, patch

from sentry.db.postgres.lookups import ArrayElementContains
from sentry.testutils.cases import TestCase


class TestArrayElementContains(TestCase):
    def setUp(self) -> None:
        self.compiler = Mock()
        self.connection = Mock()

    @patch("sentry.db.postgres.lookups.array_element_contains.ArrayElementContains.process_lhs")
    @patch("sentry.db.postgres.lookups.array_element_contains.ArrayElementContains.process_rhs")
    def test_as_sql_basic_usage(self, mock_process_rhs, mock_process_lhs):
        lhs = "column_name"
        rhs = "%s"
        mock_process_lhs.return_value = (lhs, [])
        mock_process_rhs.return_value = (rhs, [])

        lookup = ArrayElementContains(lhs, rhs)
        sql, params = lookup.as_sql(self.compiler, self.connection)

        assert (
            sql
            == """EXISTS (
            SELECT * FROM UNNEST(column_name) AS elem
            WHERE elem LIKE '%%' || %s || '%%'
        )"""
        )
        assert params == []
