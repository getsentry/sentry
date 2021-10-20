import pytest

from sentry.processing.realtime_metrics import base


class TestBucketedCounts:
    @pytest.fixture  # type: ignore
    def buckets(self) -> base.BucketedCounts:
        return base.BucketedCounts(timestamp=123, width=10, counts=[1, 2, 3])

    def test_total_time(self, buckets: base.BucketedCounts) -> None:
        assert buckets.total_time() == 30

    def test_total_count(self, buckets: base.BucketedCounts) -> None:
        assert buckets.total_count() == 6

    def test_rate(self, buckets: base.BucketedCounts) -> None:
        assert buckets.rate() == 6 / 30
        assert buckets.rate(period=10) == 3 / 10

    def test_rate_too_small_period(self, buckets: base.BucketedCounts) -> None:
        with pytest.raises(ValueError):
            buckets.rate(period=1)

    def test_rate_too_large_period(self, buckets: base.BucketedCounts) -> None:
        with pytest.raises(ValueError):
            buckets.rate(period=60)


class TestDurationsHistogram:
    def test_incr(self) -> None:
        hist = base.DurationsHistogram(bucket_size=10)
        hist.incr(3, 1)
        hist.incr(13, 2)
        hist.incr(20, 3)

        assert hist._data[0] == 1
        assert hist._data[10] == 2
        assert hist._data[20] == 3

        assert len(hist._data) == 3

    def test_incr_from(self) -> None:
        other = base.DurationsHistogram(bucket_size=10)
        other.incr(3, 1)
        other.incr(13, 2)

        hist = base.DurationsHistogram(bucket_size=11)

        with pytest.raises(AssertionError):
            hist.incr_from(other)

        hist = base.DurationsHistogram(bucket_size=10)
        hist.incr(5, 2)

        hist.incr_from(other)

        assert hist._data[0] == 3
        assert hist._data[10] == 2

    def test_total_count(self) -> None:
        hist = base.DurationsHistogram(bucket_size=10)
        hist.incr(0, 1)
        hist.incr(10, 2)

        assert hist.total_count() == 3

    @pytest.mark.parametrize("percentile, result", [(0.70, 7), (0.75, 7), (0.80, 8)])  # type: ignore
    def test_percentile(self, percentile: float, result: int) -> None:
        hist = base.DurationsHistogram(bucket_size=1)
        for i in range(1, 10):
            hist.incr(i, 1)

        assert hist.percentile(percentile) == result


class TestBucketedDurationsHistograms:
    def test_total_time(self) -> None:
        buckets = base.BucketedDurationsHistograms(
            timestamp=123, width=10, histograms=[base.DurationsHistogram()] * 5
        )

        assert buckets.total_time() == 50
