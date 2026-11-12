import pytest

from sentry.snuba import transactions
from sentry.snuba.utils import get_dataset


@pytest.mark.parametrize("dataset", ["metrics", "metricsEnhanced", "transactions"])
def test_metrics_resolves_to_indexed_events(dataset: str) -> None:
    assert get_dataset(dataset) is transactions


def test_span_metrics_are_not_supported() -> None:
    assert get_dataset("spansMetrics") is None
