from sentry.seer.anomaly_detection.types import AnomalyDetectionConfig
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
            assert get_aggregate_type(aggregate) == "count", f"Expected 'count' for {aggregate}"

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
            assert get_aggregate_type(aggregate) == "other", f"Expected 'other' for {aggregate}"

    def test_none_aggregate_returns_none(self) -> None:
        assert get_aggregate_type(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert get_aggregate_type("") is None


class TestAnomalyDetectionConfigAggregate:
    """Test that aggregate field is properly omitted when None"""

    def test_aggregate_key_present_when_count(self) -> None:
        config = AnomalyDetectionConfig(
            time_period=60,
            sensitivity="medium",
            direction="up",
            expected_seasonality="auto",
        )
        aggregate_type = get_aggregate_type("count()")
        if aggregate_type is not None:
            config["aggregate"] = aggregate_type

        assert "aggregate" in config
        assert config["aggregate"] == "count"

    def test_aggregate_key_absent_when_none(self) -> None:
        """Verify aggregate key is truly absent, not present with null value"""
        config = AnomalyDetectionConfig(
            time_period=60,
            sensitivity="medium",
            direction="up",
            expected_seasonality="auto",
        )
        aggregate_type = get_aggregate_type(None)
        if aggregate_type is not None:
            config["aggregate"] = aggregate_type

        assert "aggregate" not in config, "aggregate key should be absent, not present with None"
