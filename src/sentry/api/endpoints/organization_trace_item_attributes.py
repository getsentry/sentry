from datetime import datetime, timedelta
from typing import Literal

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeValuesRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, TraceItemFilter

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.endpoints.organization_spans_fields import BaseSpanFieldValuesAutocompletionExecutor
from sentry.api.event_search import translate_escape_sequences
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import translate_internal_to_public_alias
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.tagstore.types import TagValue
from sentry.utils import snuba_rpc


class OrganizationTraceItemAttributesEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE
    feature_flag = "organizations:ourlogs-enabled"  # Can be changed to performance-trace-explorer once spans work.


class OrganizationTraceItemAttributesEndpointSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField([e.value for e in SupportedTraceItemType], required=True)
    attribute_type = serializers.ChoiceField(["string", "number"], required=True)
    substring_match = serializers.CharField(required=False)
    query = serializers.CharField(required=False)


def is_valid_item_type(item_type: str) -> bool:
    return item_type in [e.value for e in SupportedTraceItemType]


def get_column_definitions(item_type: SupportedTraceItemType) -> ColumnDefinitions:
    return SPAN_DEFINITIONS if item_type == SupportedTraceItemType.SPANS else OURLOG_DEFINITIONS


def resolve_attribute_referrer(item_type: str, attribute_type: str) -> Referrer:
    return (
        Referrer.API_SPANS_TAG_KEYS_RPC
        if item_type == SupportedTraceItemType.SPANS.value
        else Referrer.API_LOGS_TAG_KEYS_RPC
    )


def resolve_attribute_values_referrer(item_type: str) -> Referrer:
    return (
        Referrer.API_SPANS_TAG_VALUES_RPC
        if item_type == SupportedTraceItemType.SPANS.value
        else Referrer.API_LOGS_TAG_VALUES_RPC
    )


def as_attribute_key(
    name: str, type: Literal["string", "number"], item_type: SupportedTraceItemType
):
    key = translate_internal_to_public_alias(name, type, item_type)

    if key is not None:
        name = key
    elif type == "number":
        key = f"tags[{name},number]"
    else:
        key = name

    return {
        # key is what will be used to query the API
        "key": key,
        # name is what will be used to display the tag nicely in the UI
        "name": name,
    }


def empty_filter(trace_item_type: SupportedTraceItemType):
    column_name = (
        "sentry.body" if trace_item_type == SupportedTraceItemType.LOGS else "sentry.description"
    )
    return TraceItemFilter(
        exists_filter=ExistsFilter(
            key=AttributeKey(name=column_name),
        )
    )


@region_silo_endpoint
class OrganizationTraceItemAttributesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(self.feature_flag, organization, actor=request.user):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributesEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        serialized = serializer.validated_data
        substring_match = serialized.get("substring_match", "")
        query_string = serialized.get("query")
        attribute_type = serialized.get("attribute_type")
        item_type = serialized.get("item_type")

        max_attributes = options.get("performance.spans-tags-key.max")
        value_substring_match = translate_escape_sequences(substring_match)
        trace_item_type = SupportedTraceItemType(item_type)
        referrer = resolve_attribute_referrer(trace_item_type, attribute_type)
        column_definitions = get_column_definitions(trace_item_type)
        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=column_definitions
        )
        filter, _, _ = resolver.resolve_query(query_string)
        meta = resolver.resolve_meta(referrer=referrer.value)
        meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
            trace_item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
        )

        adjusted_start_date, adjusted_end_date = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start_date
        snuba_params.end = adjusted_end_date

        filter = filter or empty_filter(trace_item_type)
        attr_type = (
            AttributeKey.Type.TYPE_DOUBLE
            if attribute_type == "number"
            else AttributeKey.Type.TYPE_STRING
        )

        rpc_request = TraceItemAttributeNamesRequest(
            meta=meta,
            limit=max_attributes,
            offset=0,
            type=attr_type,
            value_substring_match=value_substring_match,
            intersecting_attributes_filter=filter,
        )

        rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

        paginator = ChainPaginator(
            [
                [
                    as_attribute_key(attribute.name, serialized["attribute_type"], trace_item_type)
                    for attribute in rpc_response.attributes
                    if attribute.name
                ],
            ],
            max_limit=max_attributes,
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attributes,
            max_per_page=max_attributes,
        )


@region_silo_endpoint
class OrganizationTraceItemAttributeValuesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    def get(self, request: Request, organization: Organization, key: str) -> Response:
        if not features.has(self.feature_flag, organization, actor=request.user):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributesEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        sentry_sdk.set_tag("query.attribute_key", key)

        serialized = serializer.validated_data
        item_type = serialized.get("item_type")
        substring_match = serialized.get("substring_match", "")

        max_attribute_values = options.get("performance.spans-tags-values.max")

        definitions = (
            SPAN_DEFINITIONS
            if item_type == SupportedTraceItemType.SPANS.value
            else OURLOG_DEFINITIONS
        )

        executor = TraceItemAttributeValuesAutocompletionExecutor(
            organization=organization,
            snuba_params=snuba_params,
            key=key,
            query=substring_match,
            max_span_tag_values=max_attribute_values,
            definitions=definitions,
        )

        tag_values = executor.execute()
        tag_values.sort(key=lambda tag: tag.value)

        paginator = ChainPaginator([tag_values], max_limit=max_attribute_values)

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attribute_values,
            max_per_page=max_attribute_values,
        )


class TraceItemAttributeValuesAutocompletionExecutor(BaseSpanFieldValuesAutocompletionExecutor):
    def __init__(
        self,
        organization: Organization,
        snuba_params: SnubaParams,
        key: str,
        query: str | None,
        max_span_tag_values: int,
        definitions: ColumnDefinitions,
    ):
        super().__init__(organization, snuba_params, key, query, max_span_tag_values)
        self.resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=definitions
        )
        self.search_type, self.attribute_key = self.resolve_attribute_key(key, snuba_params)

    def resolve_attribute_key(
        self, key: str, snuba_params: SnubaParams
    ) -> tuple[constants.SearchType, AttributeKey]:
        resolved_attr, _ = self.resolver.resolve_attribute(key)
        return resolved_attr.search_type, resolved_attr.proto_definition

    def execute(self) -> list[TagValue]:
        if self.key in self.PROJECT_ID_KEYS:
            return self.project_id_autocomplete_function()

        if self.key in self.PROJECT_SLUG_KEYS:
            return self.project_slug_autocomplete_function()

        if self.search_type == "boolean":
            return self.boolean_autocomplete_function()

        if self.search_type == "string":
            return self.string_autocomplete_function()

        return []

    def boolean_autocomplete_function(self) -> list[TagValue]:
        return [
            TagValue(
                key=self.key,
                value="false",
                times_seen=None,
                first_seen=None,
                last_seen=None,
            ),
            TagValue(
                key=self.key,
                value="true",
                times_seen=None,
                first_seen=None,
                last_seen=None,
            ),
        ]

    def string_autocomplete_function(self) -> list[TagValue]:
        adjusted_start_date, adjusted_end_date = adjust_start_end_window(
            self.snuba_params.start_date, self.snuba_params.end_date
        )
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(adjusted_start_date)

        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(adjusted_end_date)

        query = translate_escape_sequences(self.query)

        meta = self.resolver.resolve_meta(referrer=Referrer.API_SPANS_TAG_VALUES_RPC.value)
        rpc_request = TraceItemAttributeValuesRequest(
            meta=meta,
            key=self.attribute_key,
            value_substring_match=query,
            limit=self.max_span_tag_values,
        )
        rpc_response = snuba_rpc.attribute_values_rpc(rpc_request)

        return [
            TagValue(
                key=self.key,
                value=value,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for value in rpc_response.values
            if value
        ]


def adjust_start_end_window(start_date: datetime, end_date: datetime) -> tuple[datetime, datetime]:
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return start_date, end_date
