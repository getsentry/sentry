from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Function

from sentry.search.events import constants
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import TimeseriesQueryBuilder, TopEventsQueryBuilder
from sentry.search.events.datasets.spans_indexed import (
    SpansEAPDatasetConfig,
    SpansIndexedDatasetConfig,
)
from sentry.search.events.fields import custom_time_processor
from sentry.search.events.types import SelectType
from sentry.snuba.dataset import Dataset

SPAN_UUID_FIELDS = {
    "trace",
    "trace_id",
    "transaction.id",
    "transaction_id",
    "profile.id",
    "profile_id",
    "replay.id",
    "replay_id",
}


SPAN_ID_FIELDS = {
    "id",
    "span_id",
    "parent_span",
    "parent_span_id",
    "segment.id",
    "segment_id",
}


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
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    config_class = SpansIndexedDatasetConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_resolver_map[
            constants.SPAN_STATUS
        ] = lambda status: SPAN_STATUS_CODE_TO_NAME.get(status)


class SpansEAPQueryBuilder(SpansIndexedQueryBuilderMixin, BaseQueryBuilder):
    requires_organization_condition = True
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    config_class = SpansEAPDatasetConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def _get_dataset_name(self) -> str:
        if self.dataset == Dataset.SpansEAP:
            return "events_analytics_platform"
        return self.dataset.value


class TimeseriesSpanIndexedQueryBuilder(SpansIndexedQueryBuilderMixin, TimeseriesQueryBuilder):
    config_class = SpansIndexedDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TimeseriesSpanEAPIndexedQueryBuilder(SpansEAPQueryBuilder, TimeseriesQueryBuilder):
    config_class = SpansEAPDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TopEventsSpanIndexedQueryBuilder(SpansIndexedQueryBuilderMixin, TopEventsQueryBuilder):
    config_class = SpansIndexedDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TopEventsSpanEAPQueryBuilder(SpansEAPQueryBuilder, TopEventsQueryBuilder):
    config_class = SpansEAPDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )
