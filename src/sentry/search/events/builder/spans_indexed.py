from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from sentry_protos.snuba.v1alpha.endpoint_aggregate_bucket_pb2 import (
    AggregateBucketRequest,
    AggregateBucketResponse,
)
from sentry_protos.snuba.v1alpha.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1alpha.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeKeyTransformContext,
    AttributeValue,
)
from sentry_protos.snuba.v1alpha.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Function, Op

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
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba

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


def convert_filter(where):
    OPERATOR_MAP = {
        Op.LT: ComparisonFilter.Op.OP_LESS_THAN,
        Op.GT: ComparisonFilter.Op.OP_GREATER_THAN,
        Op.LTE: ComparisonFilter.Op.OP_LESS_THAN_OR_EQUALS,
        Op.GTE: ComparisonFilter.Op.OP_GREATER_THAN_OR_EQUALS,
        Op.EQ: ComparisonFilter.Op.OP_EQUALS,
        Op.NEQ: ComparisonFilter.Op.OP_NOT_EQUALS,
    }
    filters = []
    for item in where:
        if item.lhs.name in ["timestamp", "project", "project_id", "organization_id"]:
            continue
        filters.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name=item.lhs.name, type=AttributeKey.Type.TYPE_STRING),
                    op=OPERATOR_MAP[item.op],
                    value=AttributeValue(val_str=item.rhs),
                )
            )
        )
    if len(filters) > 1:
        return TraceItemFilter(and_filter=filters)
    else:
        return filters[0]


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

    def get_rpc_query(self, referrer: str) -> RequestMeta:
        start_time_proto = ProtobufTimestamp()
        start_time_proto.FromDatetime(self.start)
        end_time_proto = ProtobufTimestamp()
        end_time_proto.FromDatetime(self.end)

        meta = RequestMeta(
            organization_id=self.organization_id,
            cogs_category="TODO: what is this?",
            referrer=referrer,
            project_ids=self.params.project_ids,
            start_timestamp=start_time_proto,
            end_timestamp=end_time_proto,
        )
        # TODO use dataset instead of this
        AGGREGATE_MAP = {
            "count": AggregateBucketRequest.FUNCTION_COUNT,
        }
        print(convert_filter(self.where))
        aggregate_req = AggregateBucketRequest(
            meta=meta,
            # lol hax
            aggregate=AGGREGATE_MAP[self.aggregates[0].alias],
            filter=convert_filter(self.where),
            granularity_secs=60,
            key=AttributeKey(name="duration", type=AttributeKey.TYPE_FLOAT),
            attribute_key_transform_context=AttributeKeyTransformContext(),
        )
        print(aggregate_req)
        aggregate_resp = snuba.rpc(aggregate_req, AggregateBucketResponse)
        print(aggregate_resp.result)
        return aggregate_resp.result


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
