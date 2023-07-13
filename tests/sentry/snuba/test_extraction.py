from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import is_on_demand_query


def test_is_on_demand_query_wrong_dataset():
    assert is_on_demand_query(Dataset.Transactions, "count()", "geo.city:=Vienna") is False
    assert (
        is_on_demand_query(Dataset.Metrics, "count()", "browser.version:=1 os.name:=android")
        is False
    )


def test_is_on_demand_query_no_query():
    assert is_on_demand_query(Dataset.PerformanceMetrics, "count()", "") is False


def test_is_on_demand_query_invalid_query():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count()", "AND") is False
    assert is_on_demand_query(dataset, "count()", "(AND transaction.duration:>=1") is False
    assert is_on_demand_query(dataset, "count()", "transaction.duration:>=abc") is False


def test_is_on_demand_query_true():
    dataset = Dataset.PerformanceMetrics

    # transaction.duration is a non-standard field
    assert is_on_demand_query(dataset, "count()", "transaction.duration:>=1") is True
    # transaction.duration is a non-standard field
    assert is_on_demand_query(dataset, "count()", "geo.city:=Vienna") is True
    # os.name is a standard field, browser.version is not
    assert is_on_demand_query(dataset, "count()", "browser.version:=1 os.name:=android") is True
    # os.version is not a standard field
    assert (
        is_on_demand_query(
            dataset, "count()", "(release:=a OR transaction.op:=b) transaction.duration:>1s"
        )
        is True
    )


def test_is_on_demand_query_false():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count()", "") is False
    assert is_on_demand_query(dataset, "count()", "environment:=dev") is False
    assert is_on_demand_query(dataset, "count()", "release:=initial OR os.name:=android") is False
    assert (
        is_on_demand_query(
            dataset, "count()", "(http.method:=POST OR http.status_code:=404) browser.name:=chrome"
        )
        is False
    )


def test_is_on_demand_query_countif():
    dataset = Dataset.PerformanceMetrics

    assert is_on_demand_query(dataset, "count_if(transaction.duration,equals,300)", "") is True
    assert is_on_demand_query(dataset, 'count_if(release,equals,"foo")', "") is False
