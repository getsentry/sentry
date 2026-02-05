from sentry.seer.anomaly_detection.types import AggregateType
from sentry.seer.anomaly_detection.utils import get_aggregate_type


class TestGetAggregateType:
    """Unit tests for get_aggregate_type utility function"""

    def test_count_aggregates_return_count(self) -> None:
        count_aggregates = [
            "count()",
            "COUNT()",
            "count_unique(user)",
            "count_unique(tags[sentry:user])",
            "count_if(transaction.duration,greater,300)",
        ]
        for aggregate in count_aggregates:
            assert (
                get_aggregate_type(aggregate) == AggregateType.COUNT
            ), f"Expected AggregateType.COUNT for {aggregate}"

    def test_non_count_aggregates_return_other(self) -> None:
        other_aggregates = [
            "avg(transaction.duration)",
            "p50(transaction.duration)",
            "p95(transaction.duration)",
            "p99(transaction.duration)",
            "max(transaction.duration)",
            "min(transaction.duration)",
            "sum(transaction.duration)",
            "failure_rate()",
            "apdex(300)",
        ]
        for aggregate in other_aggregates:
            assert (
                get_aggregate_type(aggregate) == AggregateType.OTHER
            ), f"Expected AggregateType.OTHER for {aggregate}"

    def test_none_aggregate_returns_none(self) -> None:
        assert get_aggregate_type(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert get_aggregate_type("") is None
