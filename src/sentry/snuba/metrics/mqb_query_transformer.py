from snuba_sdk.query import Query

from sentry.snuba.metrics.query import MetricsQuery


def tranform_mqb_query_to_metrics_query(query: Query) -> MetricsQuery:
    return query
