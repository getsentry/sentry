from datetime import datetime, timedelta

import pytest
from snuba_sdk import Direction, Granularity

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics import MetricField, MetricsQuery, OrderBy
from sentry.snuba.metrics.naming_layer import SessionMetricKey


def test_order_by_field_in_select():
    metric_field_1 = MetricField(op="avg", metric_name=SessionMetricKey.DURATION.value)
    metric_field_2 = MetricField(op=None, metric_name=SessionMetricKey.ALL.value)

    metrics_query_dict = {
        "org_id": 1,
        "project_ids": [1, 2],
        "start": datetime.now() - timedelta(hours=1),
        "end": datetime.now(),
        "granularity": Granularity(3600),
        "select": [metric_field_1],
        "orderby": OrderBy(field=metric_field_2, direction=Direction.ASC),
    }

    # Test that ensures an instance of `InvalidParams` is raised when requesting an orderBy field
    # that is not present in the select
    with pytest.raises(InvalidParams):
        MetricsQuery(**metrics_query_dict)

    # Validate no exception is raised when orderBy is in the select
    metrics_query_dict.update({"select": [metric_field_1, metric_field_2]})
    MetricsQuery(**metrics_query_dict)


def test_limit_logic():
    ...


def test_histogram_bucket_validation():
    ...


def test_series_and_totals_validation():
    ...


def test_granularity_validation():
    # # making sure intervals are cleanly divisible
    # with pytest.raises(
    #         InvalidParams, match="The interval should divide one day without a remainder."
    # ):
    #     get_date_range({"statsPeriod": "6h", "interval": "59m"})
    #
    # with pytest.raises(
    #         InvalidParams, match="The interval should divide one day without a remainder."
    # ):
    #     get_date_range({"statsPeriod": "4d", "interval": "5h"})
    #
    # with pytest.raises(
    #         InvalidParams,
    #         match="The interval has to be a multiple of the minimum interval of ten seconds.",
    # ):
    #     get_date_range({"statsPeriod": "1h", "interval": "9s"})
    #
    # with pytest.raises(
    #         InvalidParams, match="Your interval and date range would create too many results."
    # ):
    #     get_date_range({"statsPeriod": "90d", "interval": "10s"})
    ...
