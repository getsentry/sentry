from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import AliasedExpression, Column, Function

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import constants
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import TimeseriesQueryBuilder, TopEventsQueryBuilder
from sentry.search.events.datasets.spans_indexed import (
    SpansEAPDatasetConfig,
    SpansIndexedDatasetConfig,
)
from sentry.search.events.fields import custom_time_processor
from sentry.search.events.types import SelectType

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

DURATION_FIELDS = {
    "span.duration",
    "span.self_time",
}

SIZE_FIELDS = {
    "http.decoded_response_content_length": "byte",
    "http.response_content_length": "byte",
    "http.response_transfer_size": "byte",
}


class SpansIndexedQueryBuilder(BaseQueryBuilder):
    requires_organization_condition = False
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    duration_fields = DURATION_FIELDS
    size_fields = SIZE_FIELDS
    config_class = SpansIndexedDatasetConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.value_resolver_map[constants.SPAN_STATUS] = (
            lambda status: SPAN_STATUS_CODE_TO_NAME.get(status)
        )


class SpansEAPQueryBuilder(BaseQueryBuilder):
    requires_organization_condition = True
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    duration_fields = DURATION_FIELDS
    size_fields = SIZE_FIELDS
    config_class = SpansEAPDatasetConfig

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def resolve_field(self, raw_field: str, alias: bool = False) -> Column:
        # try the typed regex first
        if len(raw_field) > constants.MAX_TAG_KEY_LENGTH:
            raise InvalidSearchQuery(f"{raw_field} is too long, can be a maximum of 200 characters")

        tag_match = constants.TYPED_TAG_KEY_RE.search(raw_field)
        field = tag_match.group("tag") if tag_match else None
        field_type = tag_match.group("type") if tag_match else None
        if (
            field is None
            or field_type is None
            or not constants.VALID_FIELD_PATTERN.match(field)
            # attr field is less permissive than tags, we can't have - in them
            or "-" in field
        ):
            return super().resolve_field(raw_field, alias)

        if field_type not in ["number", "string"]:
            raise InvalidSearchQuery(
                f"Unknown type for field {raw_field}, only string and number are supported"
            )

        if field_type == "string":
            field_col = Column(f"attr_str[{field}]")
        else:
            field_col = Column(f"attr_num[{field}]")

        if alias:
            field_alias = f"tags_{field}@{field_type}"

            self.typed_tag_to_alias_map[raw_field] = field_alias
            self.alias_to_typed_tag_map[field_alias] = raw_field

            field_col = AliasedExpression(field_col, field_alias)

        return field_col


class TimeseriesSpanIndexedQueryBuilder(TimeseriesQueryBuilder):
    config_class = SpansIndexedDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    duration_fields = DURATION_FIELDS
    size_fields = SIZE_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TimeseriesSpanEAPIndexedQueryBuilder(SpansEAPQueryBuilder, TimeseriesQueryBuilder):
    pass


class TopEventsSpanIndexedQueryBuilder(TopEventsQueryBuilder):
    config_class = SpansIndexedDatasetConfig
    uuid_fields = SPAN_UUID_FIELDS
    span_id_fields = SPAN_ID_FIELDS
    duration_fields = DURATION_FIELDS
    size_fields = SIZE_FIELDS

    @property
    def time_column(self) -> SelectType:
        return custom_time_processor(
            self.interval, Function("toUInt32", [Column("start_timestamp")])
        )


class TopEventsSpanEAPQueryBuilder(SpansEAPQueryBuilder, TopEventsQueryBuilder):
    pass
