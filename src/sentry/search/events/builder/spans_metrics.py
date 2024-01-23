from typing import Any, List, Optional, Tuple

from snuba_sdk import Condition, Granularity

from sentry.api import event_search
from sentry.search.events import constants
from sentry.search.events import filter as event_filter
from sentry.search.events.builder import (
    MetricsQueryBuilder,
    TimeseriesMetricQueryBuilder,
    TopMetricsQueryBuilder,
)
from sentry.search.events.fields import is_function
from sentry.search.events.types import QueryBuilderConfig, SelectType, WhereType


class SpansMetricsQueryBuilder(MetricsQueryBuilder):
    requires_organization_condition = True
    spans_metrics_builder = True
    has_transaction = False
    use_count_per_segment = True
    use_count_per_op = True

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

    def resolve_where(self, parsed_terms: event_filter.ParsedTerms) -> List[WhereType]:
        """
        use count_by_segment if filter ONLY includes segment OR release, or nothing at all.
        """
        for term in parsed_terms:
            if isinstance(term, event_search.SearchFilter):
                key = self.format_search_filter(term)
                if key not in ["transaction", "release"]:
                    self.use_count_per_segment = False
                if key not in ["span.op"]:
                    self.use_count_per_op = False

        return super().resolve_where(parsed_terms)

    def resolve_select(
        self, selected_columns: Optional[List[str]], equations: Optional[List[str]]
    ) -> List[SelectType]:
        if selected_columns:
            if "transaction" in selected_columns:
                self.has_transaction = True

            for column in selected_columns:
                if is_function(column):
                    continue

                """
                use count_by_op if group by is ONLY OP and requesting count().
                """
                if column not in ["transaction", "release"]:
                    self.use_count_per_segment = False
                if column not in ["span.op"]:
                    self.use_count_per_op = False

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
