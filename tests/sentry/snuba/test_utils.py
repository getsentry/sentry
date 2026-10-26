from sentry.snuba import metrics_performance
from sentry.snuba.utils import get_dataset


def test_metrics_resolves_to_metrics_performance() -> None:
    assert get_dataset("metrics") is metrics_performance
