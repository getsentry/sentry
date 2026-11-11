from sentry.snuba import metrics_enhanced_performance
from sentry.snuba.utils import get_dataset


def test_metrics_resolves_to_indexed_events() -> None:
    assert get_dataset("metrics") is metrics_enhanced_performance


def test_span_metrics_are_not_supported() -> None:
    assert get_dataset("spansMetrics") is None
