from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset


class TraceMetricsQueryBuilder(DiscoverQueryBuilder):
    """Query builder for trace metrics dataset"""

    @property
    def config(self) -> QueryBuilderConfig:
        config = super().config
        config.auto_fields = True
        config.auto_aggregations = True
        config.use_aggregate_conditions = True
        return config


class TraceMetrics:
    """Trace Metrics dataset handler"""

    dataset = Dataset.Metrics
    query_builder_cls = TraceMetricsQueryBuilder

    @classmethod
    def query(
        cls,
        selected_columns,
        query,
        params,
        snuba_params=None,
        equations=None,
        orderby=None,
        offset=0,
        limit=50,
        referrer=None,
        auto_fields=False,
        auto_aggregations=False,
        use_aggregate_conditions=False,
        allow_metric_aggregates=None,
        transform_alias_to_input_format=None,
        has_metrics=False,
        functions_acl=None,
        on_demand_metrics_enabled=False,
        on_demand_metrics_type=None,
        dataset=None,
    ):
        """
        Query trace metrics dataset
        """
        # Override dataset to metrics
        dataset = Dataset.Metrics

        # Build and execute query similar to discover
        builder = cls.query_builder_cls(
            dataset=dataset,
            params=params,
            snuba_params=snuba_params,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            orderby=orderby,
            limit=limit,
            offset=offset,
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            use_aggregate_conditions=use_aggregate_conditions,
            functions_acl=functions_acl,
            has_metrics=True,
            transform_alias_to_input_format=transform_alias_to_input_format,
            on_demand_metrics_enabled=on_demand_metrics_enabled,
            on_demand_metrics_type=on_demand_metrics_type,
        )

        result = builder.process_results(builder.run_query(referrer=referrer))
        return result


# Singleton instance
tracemetrics = TraceMetrics()
