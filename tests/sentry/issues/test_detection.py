from sentry.issues.detection import http_within_sql_transaction
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import create_span


class DetectionTest(TestCase):
    def test_http_within_sql_transaction(self):
        f = http_within_sql_transaction()
        # print(f)  # TODO

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
                create_span("db", 100, "COMMIT"),
                create_span("http.client", 1000, "GET https://example.com/"),
            ]
        )
