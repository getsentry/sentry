from snuba_sdk import Entity, Flags, Query, Request

from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.datasets.metrics_summaries import MetricsSummariesDatasetConfig
from sentry.snuba.dataset import Dataset


class MetricsSummariesQueryBuilder(BaseQueryBuilder):
    requires_organization_condition = False
    config_class = MetricsSummariesDatasetConfig

    def get_field_type(self, field: str) -> str | None:
        if field in ["min_metric", "max_metric", "sum_metric", "count_metric"]:
            return "number"
        return None

    def get_snql_query(self) -> Request:
        self.validate_having_clause()

        return Request(
            # the metrics summaries entity exists within the spans indexed dataset
            dataset=Dataset.SpansIndexed.value,
            app_id="default",
            query=Query(
                match=Entity(self.dataset.value, sample=self.sample_rate),
                select=self.columns,
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=self.limitby,
            ),
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )
