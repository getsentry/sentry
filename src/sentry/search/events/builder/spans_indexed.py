from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Function

from sentry.search.events import constants
from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder, TopEventsQueryBuilder
from sentry.search.events.types import SelectType


class SpansIndexedQueryBuilder(QueryBuilder):
    requires_organization_condition = False
    free_text_key = "span.description"
    uuid_fields = {"transaction.id", "replay.id", "profile.id", "trace"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_resolver_map[
            constants.SPAN_STATUS
        ] = lambda status: SPAN_STATUS_CODE_TO_NAME.get(status)

    def get_field_type(self, field: str) -> str | None:
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
