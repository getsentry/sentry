from typing import Optional

from snuba_sdk import Column, Function

from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder, TopEventsQueryBuilder
from sentry.search.events.types import SelectType


class SpansIndexedQueryBuilder(QueryBuilder):
    requires_organization_condition = False

    def get_field_type(self, field: str) -> Optional[str]:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.self_time"]:
            return "duration"

        return None


class TimeseriesSpanIndexedQueryBuilder(TimeseriesQueryBuilder):
    @property
    def time_column(self) -> SelectType:
        return Function("toStartOfHour", [Column("end_timestamp")], "time")


class TopEventsSpanIndexedQueryBuilder(TopEventsQueryBuilder):
    @property
    def time_column(self) -> SelectType:
        return Function("toStartOfHour", [Column("timestamp")], "time")
