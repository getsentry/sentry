from sentry.issues.detection import http_within_sql_transaction, http_within_sql_transaction_native
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import create_span


class DetectionTest(TestCase):
    def test_http_within_sql_transaction(self):
        f = http_within_sql_transaction()

        expected = (
            "Precedes(\n"
            "  And(EqLiteral(op, 'db'), PrefixLiteral(description, 'BEGIN')),\n"
            "  And(EqLiteral(op, 'http.client'), DurationGtLiteral(0.25)),\n"
            "  And(EqLiteral(op, 'db'), Or(PrefixLiteral(description, 'COMMIT'), PrefixLiteral(description, 'ROLLBACK'))),\n"
            ")"
        )
        assert f.dumps() == expected

        assert f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("http.client", 1000, "GET https://example.com/"),
                create_span("db", 100, "COMMIT"),
            ]
        )
        assert not f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("http.client", 100, "GET https://example.com/"),
                create_span("db", 100, "COMMIT"),
            ]
        )
        assert not f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("db", 100, "COMMIT"),
                create_span("http.client", 1000, "GET https://example.com/"),
            ]
        )

    def test_http_within_sql_transaction_native(self):
        f = http_within_sql_transaction_native()

        assert f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("http.client", 1000, "GET https://example.com/"),
                create_span("db", 100, "COMMIT"),
            ]
        )
        assert not f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("http.client", 100, "GET https://example.com/"),
                create_span("db", 100, "COMMIT"),
            ]
        )
        assert not f(
            [
                create_span("db", 100, "BEGIN"),
                create_span("db", 100, "COMMIT"),
                create_span("http.client", 1000, "GET https://example.com/"),
            ]
        )
