import unittest

from sentry.spans.grouping.strategy.wildcard_replacement_strategy import WildcardReplacementStrategy
from sentry.testutils.performance_issues.span_builder import SpanBuilder


class WildcardReplacementStrategyTest(unittest.TestCase):
    def test_replaces_wildcards(self):
        event_data = {
            "transaction": "transaction name",
            "contexts": {
                "trace": {
                    "span_id": "a" * 16,
                },
            },
            "spans": [
                SpanBuilder()
                .with_op("http.client")
                .with_description("GET /api/0/organizations/sentry/details")
                .build(),
            ],
        }

        strategy = WildcardReplacementStrategy(event_data)
        assert strategy(event_data["spans"][0]) == ["GET", "", "", "/api/0/organizations/*/details"]
