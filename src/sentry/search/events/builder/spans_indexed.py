from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Function

from sentry.api.event_search import SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import TimeseriesQueryBuilder, TopEventsQueryBuilder
from sentry.search.events.datasets.spans_indexed import SpansIndexedDatasetConfig
from sentry.search.events.fields import custom_time_processor
from sentry.search.events.types import SelectType, WhereType
from sentry.utils.validators import INVALID_ID_DETAILS, INVALID_SPAN_ID, WILDCARD_NOT_ALLOWED


class SpansIndexedQueryBuilderMixin:
    meta_resolver_map: dict[str, str]

    def get_field_type(self, field: str) -> str | None:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.self_time"]:
            return "duration"

        return None


class SpansIndexedQueryBuilder(SpansIndexedQueryBuilderMixin, BaseQueryBuilder):
    requires_organization_condition = False
    uuid_fields = {"transaction.id", "replay.id", "profile.id", "trace"}
    config_class = SpansIndexedDatasetConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_resolver_map[
            constants.SPAN_STATUS
        ] = lambda status: SPAN_STATUS_CODE_TO_NAME.get(status)

    def default_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        validate_id_like_search_filter(search_filter)
        return super().default_filter_converter(search_filter)


class TimeseriesSpanIndexedQueryBuilder(SpansIndexedQueryBuilderMixin, TimeseriesQueryBuilder):
    config_class = SpansIndexedDatasetConfig

    def default_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        validate_id_like_search_filter(search_filter)
        return super().default_filter_converter(search_filter)

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TopEventsSpanIndexedQueryBuilder(SpansIndexedQueryBuilderMixin, TopEventsQueryBuilder):
    config_class = SpansIndexedDatasetConfig

    def default_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        validate_id_like_search_filter(search_filter)
        return super().default_filter_converter(search_filter)

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


SPAN_ID_FIELDS = {
    "id": "Filter Span ID",
    "span_id": "Filter Span ID",
    "parent_span": "Filter Parent Span ID",
    "parent_span_id": "Filter Parent Span ID",
    "segment.id": "Filter Segment ID",
    "segment_id": "Filter Segment ID",
}

UUID_FIELDS = {
    "trace": "Filter Trace ID",
    "trace_id": "Filter Trace ID",
    "transaction.id": "Filter Transaction ID",
    "transaction_id": "Filter Transaction ID",
    "profile.id": "Filter Profile ID",
    "profile_id": "Filter Profile ID",
    "replay.id": "Filter Replay ID",
    "replay_id": "Filter Replay ID",
}


def validate_id_like_search_filter(search_filter: SearchFilter):
    name = search_filter.key.name

    if label := SPAN_ID_FIELDS.get(name):
        if search_filter.value.is_wildcard():
            raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(label))
        if not search_filter.value.is_span_id():
            raise InvalidSearchQuery(INVALID_SPAN_ID.format(label))

    if label := UUID_FIELDS.get(name):
        if search_filter.value.is_wildcard():
            raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(label))
        if not search_filter.value.is_event_id():
            raise InvalidSearchQuery(INVALID_ID_DETAILS.format(label))
