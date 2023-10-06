from typing import Any, List, Optional, Tuple

from snuba_sdk import Condition, Granularity

from sentry.search.events import constants
from sentry.search.events.builder import (
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.types import QueryBuilderConfig, SelectType


class SpansMetricsQueryBuilder(MetricsQueryBuilder):
    requires_organization_condition = True
    spans_metrics_builder = True
    has_transaction = False

    def __init__(
        self,
        *args: Any,
        **kwargs: Any,
    ):
        config = kwargs.pop("config", None)
        if config is None:
            config = QueryBuilderConfig()
        parser_config_overrides = (
            config.parser_config_overrides if config.parser_config_overrides else {}
        )
        parser_config_overrides["free_text_key"] = "span.description"
        config.parser_config_overrides = parser_config_overrides
        kwargs["config"] = config
        super().__init__(*args, **kwargs)

    def get_field_type(self, field: str) -> Optional[str]:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.self_time"]:
            return "duration"

        return None

    def resolve_select(
        self, selected_columns: Optional[List[str]], equations: Optional[List[str]]
    ) -> List[SelectType]:
        if selected_columns and "transaction" in selected_columns:
            self.has_transaction = True
        return super().resolve_select(selected_columns, equations)

    def resolve_metric_index(self, value: str) -> Optional[int]:
        """Layer on top of the metric indexer so we'll only hit it at most once per value"""

        # This check is a bit brittle, and depends on resolve_conditions happening before resolve_select
        if value == "transaction":
            self.has_transaction = True
        if not self.has_transaction and value == constants.SPAN_METRICS_MAP["span.self_time"]:
            return super().resolve_metric_index(constants.SELF_TIME_LIGHT)

        return super().resolve_metric_index(value)


class TimeseriesSpansMetricsQueryBuilder(SpansMetricsQueryBuilder, TimeseriesMetricQueryBuilder):
    def resolve_split_granularity(self) -> Tuple[List[Condition], Optional[Granularity]]:
        """Don't do this for timeseries"""
        return [], self.granularity


class TopSpansMetricsQueryBuilder(TimeseriesSpansMetricsQueryBuilder, TopMetricsQueryBuilder):
    pass
