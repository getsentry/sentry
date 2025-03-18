from enum import Enum
from datetime import timedelta
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
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ExistsFilter,
    TraceItemFilter,
)
from sentry_protos.snuba.v1.request_common_pb2 import (
    RequestMeta,
    TraceItemType as ProtoTraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.event_search import translate_escape_sequences
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.spans.utils import translate_internal_to_public_alias
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.tagstore.types import TagValue
from sentry.utils import snuba_rpc


class TraceItemType(str, Enum):
    LOGS = "logs"
    SPANS = "spans"


# Mapping from our enum types to the protobuf enum types
TRACE_ITEM_TYPE_MAP = {
    TraceItemType.LOGS: ProtoTraceItemType.TRACE_ITEM_TYPE_LOG,
    TraceItemType.SPANS: ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN,
}


def as_attribute_key(name: str, type: Literal["string", "number"]):
    key = translate_internal_to_public_alias(name, type)

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


class OrganizationTraceItemAttributesEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE


class OrganizationTraceItemAttributesEndpointSerializer(serializers.Serializer):
    dataset = serializers.ChoiceField([e.value for e in TraceItemType], required=True)
    type = serializers.ChoiceField(["string", "number"], required=True)
    substring = serializers.CharField(required=False)


def is_valid_dataset(dataset: str) -> bool:
    return dataset in [e.value for e in TraceItemType]


@region_silo_endpoint
class OrganizationTraceItemAttributesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        if not is_valid_dataset(request.GET.get("dataset")):
            return Response({"detail": "Invalid dataset"}, status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        substring_match = request.GET.get("substring", "")

        serializer = OrganizationTraceItemAttributesEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        max_attributes = options.get("performance.spans-tags-key.max")

        snuba_params.start = snuba_params.start_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        snuba_params.end = snuba_params.end_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

        dataset_type = TraceItemType(serialized["dataset"])

        # Map the dataset to the appropriate referrer
        referrer_map = {
            TraceItemType.SPANS: Referrer.API_SPANS_TAG_KEYS_RPC,
            TraceItemType.LOGS: Referrer.API_LOGS_TAG_KEYS_RPC,
        }
        referrer = referrer_map.get(dataset_type, Referrer.API_SPANS_TAG_KEYS_RPC)

        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )
        meta = resolver.resolve_meta(referrer=referrer.value)
        meta.trace_item_type = TRACE_ITEM_TYPE_MAP.get(
            dataset_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
        )

        attr_type = (
            AttributeKey.Type.TYPE_DOUBLE
            if serialized["type"] == "number"
            else AttributeKey.Type.TYPE_STRING
        )

        # 🤌 All the attributes for the org 🤌
        trace_item_filter = TraceItemFilter(
            exists_filter=ExistsFilter(
                key=AttributeKey(
                    name="sentry.organization_id",
                    type=AttributeKey.Type.TYPE_INT,
                ),
            ),
        )

        rpc_request = TraceItemAttributeNamesRequest(
            meta=meta,
            limit=max_attributes,
            offset=0,
            type=attr_type,
            value_substring_match=substring_match,
            intersecting_attributes_filter=trace_item_filter,
        )

        rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

        paginator = ChainPaginator(
            [
                [
                    as_attribute_key(attribute.name, serialized["type"])
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
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        if not is_valid_dataset(request.GET.get("dataset")):
            return Response({"detail": "Invalid dataset"}, status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        sentry_sdk.set_tag("query.attribute_key", key)

        max_attribute_values = options.get("performance.spans-tags-values.max")

        serializer = OrganizationTraceItemAttributesEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        dataset_type = TraceItemType(serialized["dataset"])

        # Map the dataset to the appropriate referrer
        referrer_map = {
            TraceItemType.SPANS: Referrer.API_SPANS_TAG_VALUES_RPC,
            TraceItemType.LOGS: Referrer.API_LOGS_TAG_VALUES_RPC,
        }
        referrer = referrer_map.get(dataset_type, Referrer.API_SPANS_TAG_VALUES_RPC)

        # Create start and end timestamps
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(
            snuba_params.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        )

        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(
            snuba_params.end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            + timedelta(days=1)
        )

        # Create the RequestMeta object
        meta = RequestMeta(
            organization_id=organization.id,
            project_ids=snuba_params.project_ids,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            trace_item_type=TRACE_ITEM_TYPE_MAP.get(
                dataset_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
            ),
            referrer=referrer.value,
        )

        query = translate_escape_sequences(request.GET.get("query", ""))

        # Create a basic attribute key
        attribute_key = AttributeKey(
            name=key,
            type=(
                AttributeKey.Type.TYPE_DOUBLE
                if serialized["type"] == "number"
                else AttributeKey.Type.TYPE_STRING
            ),
        )

        rpc_request = TraceItemAttributeValuesRequest(
            meta=meta,
            key=attribute_key,
            value_substring_match=query,
            limit=max_attribute_values,
        )

        rpc_response = snuba_rpc.attribute_values_rpc(rpc_request)

        tag_values = [
            TagValue(
                key=key,
                value=value,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for value in rpc_response.values
            if value
        ]

        tag_values.sort(key=lambda tag: tag.value)

        paginator = ChainPaginator([tag_values], max_limit=max_attribute_values)

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attribute_values,
            max_per_page=max_attribute_values,
        )
