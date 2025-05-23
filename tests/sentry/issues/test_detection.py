from sentry.issues.detection import http_within_sql_transaction, http_within_sql_transaction_native
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import create_span


class DetectionTest(TestCase):
    def test_http_within_sql_transaction(self):
        f = http_within_sql_transaction()

        assert f.dumps() == (
            "(\n"
            "  (op=db AND description=BEGIN*)\n"
            "  ...\n"
            "  (op=http.client AND duration>0.25)\n"
            "  ...\n"
            "  (op=db AND (description=COMMIT* OR description=ROLLBACK*))\n"
            ")"
        )

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
