import logging

from sentry.search.events.builder import SpansMetricsQueryBuilder
from sentry.utils.snuba import Dataset

logger = logging.getLogger(__name__)


def query(
    selected_columns,
    query,
    params,
    snuba_params=None,
    equations=None,
    orderby=None,
    offset=None,
    limit=50,
    referrer=None,
    auto_fields=False,
    auto_aggregations=False,
    include_equation_fields=False,
    allow_metric_aggregates=False,
    use_aggregate_conditions=False,
    conditions=None,
    functions_acl=None,
    transform_alias_to_input_format=False,
    sample=None,
    has_metrics=False,
    use_metrics_layer=False,
    skip_tag_resolution=False,
    extra_columns=None,
):
    builder = SpansMetricsQueryBuilder(
        dataset=Dataset.Metrics,
        params=params,
        snuba_params=snuba_params,
        query=query,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        functions_acl=functions_acl,
        limit=limit,
        offset=offset,
        equation_config={"auto_add": include_equation_fields},
        sample_rate=sample,
        has_metrics=has_metrics,
        transform_alias_to_input_format=transform_alias_to_input_format,
        skip_tag_resolution=skip_tag_resolution,
    )

    result = builder.process_results(builder.run_query(referrer))
    return result
