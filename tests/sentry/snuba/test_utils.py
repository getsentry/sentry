import pytest

from sentry.snuba import transactions
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.utils import DATASET_LABELS, get_dataset


@pytest.mark.parametrize("dataset", ["metrics", "metricsEnhanced", "transactions"])
def test_metrics_resolves_to_indexed_events(dataset: str) -> None:
    assert get_dataset(dataset) is transactions


@pytest.mark.parametrize("dataset", ["spansMetrics", "spans"])
def test_span_metrics_resolve_to_indexed_spans(dataset: str) -> None:
    assert get_dataset(dataset) is Spans


def test_spans_dataset_keeps_canonical_label() -> None:
    assert DATASET_LABELS[Spans] == "spans"
