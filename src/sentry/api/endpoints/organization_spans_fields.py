from abc import ABC, abstractmethod
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
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import translate_escape_sequences
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute, translate_internal_to_public_alias
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.tagstore.types import TagValue
from sentry.utils import snuba_rpc


def as_tag_key(name: str, type: Literal["string", "number"]):
    key, _, _ = translate_internal_to_public_alias(name, type, SupportedTraceItemType.SPANS)

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


class OrganizationSpansFieldsEndpointBase(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING


class OrganizationSpansFieldsEndpointSerializer(serializers.Serializer):
    type = serializers.ChoiceField(["string", "number"], required=False, default="string")


@region_silo_endpoint
class OrganizationSpansFieldsEndpoint(OrganizationSpansFieldsEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        performance_trace_explorer = features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        )

        visibility_explore_view = features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

        if not performance_trace_explorer and not visibility_explore_view:
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        serializer = OrganizationSpansFieldsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        max_span_tags = options.get("performance.spans-tags-key.max")

        snuba_params.start = snuba_params.start_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        snuba_params.end = snuba_params.end_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)

        with handle_query_errors():
            resolver = SearchResolver(
                params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
            )
            meta = resolver.resolve_meta(referrer=Referrer.API_SPANS_TAG_KEYS_RPC.value)

            rpc_request = TraceItemAttributeNamesRequest(
                meta=meta,
                limit=max_span_tags,
                offset=0,
                type=(
                    AttributeKey.Type.TYPE_DOUBLE
                    if serialized["type"] == "number"
                    else AttributeKey.Type.TYPE_STRING
                ),
            )

            rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

        include_internal = is_active_superuser(request) or is_active_staff(request)

        paginator = ChainPaginator(
            [
                [
                    as_tag_key(attribute.name, serialized["type"])
                    for attribute in rpc_response.attributes
                    if attribute.name
                    and can_expose_attribute(
                        attribute.name,
                        SupportedTraceItemType.SPANS,
                        include_internal=include_internal,
                    )
                ],
            ],
            max_limit=max_span_tags,
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_span_tags,
            max_per_page=max_span_tags,
        )


@region_silo_endpoint
class OrganizationSpansFieldValuesEndpoint(OrganizationSpansFieldsEndpointBase):
    def get(self, request: Request, organization: Organization, key: str) -> Response:
        performance_trace_explorer = features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        )

        visibility_explore_view = features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

        if not performance_trace_explorer and not visibility_explore_view:
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        sentry_sdk.set_tag("query.tag_key", key)

        max_span_tag_values = options.get("performance.spans-tags-values.max")

        executor = EAPSpanFieldValuesAutocompletionExecutor(
            organization=organization,
            snuba_params=snuba_params,
            key=key,
            query=request.GET.get("query"),
            max_span_tag_values=max_span_tag_values,
        )

        with handle_query_errors():
            tag_values = executor.execute()

        tag_values.sort(key=lambda tag: tag.value or "")

        paginator = ChainPaginator([tag_values], max_limit=max_span_tag_values)

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_span_tag_values,
            max_per_page=max_span_tag_values,
        )


class BaseSpanFieldValuesAutocompletionExecutor(ABC):
    PROJECT_SLUG_KEYS = {"project", "project.name"}
    PROJECT_ID_KEYS = {"project.id"}

    def __init__(
        self,
        organization: Organization,
        snuba_params: SnubaParams,
        key: str,
        query: str | None,
        max_span_tag_values: int,
    ):
        self.organization = organization
        self.snuba_params = snuba_params
        self.key = key
        self.query = query or ""
        self.max_span_tag_values = max_span_tag_values

    @abstractmethod
    def execute(self) -> list[TagValue]:
        raise NotImplementedError

    def project_id_autocomplete_function(self) -> list[TagValue]:
        return [
            TagValue(
                key=self.key,
                value=str(project.id),
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for project in self.snuba_params.projects
            if not self.query or self.query in str(project.id)
        ]

    def project_slug_autocomplete_function(self) -> list[TagValue]:
        return [
            TagValue(
                key=self.key,
                value=project.slug,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for project in self.snuba_params.projects
            if not self.query or self.query in project.slug
        ]


class EAPSpanFieldValuesAutocompletionExecutor(BaseSpanFieldValuesAutocompletionExecutor):
    def __init__(
        self,
        organization: Organization,
        snuba_params: SnubaParams,
        key: str,
        query: str | None,
        max_span_tag_values: int,
    ):
        super().__init__(organization, snuba_params, key, query, max_span_tag_values)
        self.resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )
        self.search_type, self.attribute_key = self.resolve_attribute_key(key, snuba_params)

    def resolve_attribute_key(
        self, key: str, snuba_params: SnubaParams
    ) -> tuple[constants.SearchType, AttributeKey]:
        resolved, _ = self.resolver.resolve_attribute(key)
        return resolved.search_type, resolved.proto_definition

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
        start_timestamp = Timestamp()
        start_timestamp.FromDatetime(
            self.snuba_params.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        )

        end_timestamp = Timestamp()
        end_timestamp.FromDatetime(
            self.snuba_params.end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            + timedelta(days=1)
        )

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
