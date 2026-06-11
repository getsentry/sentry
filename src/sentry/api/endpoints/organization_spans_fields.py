import logging
from datetime import timedelta
from typing import Literal

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
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
from sentry.search.eap.utils import can_expose_attribute_to_api, translate_internal_to_public_alias
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


def as_tag_key(name: str, search_type: Literal["string", "number", "boolean"]):
    key, _, _ = translate_internal_to_public_alias(name, search_type, SupportedTraceItemType.SPANS)

    if key is not None:
        name = key
    elif search_type == "number":
        key = f"tags[{name},number]"
    elif search_type == "boolean":
        key = f"tags[{name},boolean]"
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
    type = serializers.ChoiceField(
        ["string", "number", "boolean"], required=False, default="string"
    )


@cell_silo_endpoint
class OrganizationSpansFieldsEndpoint(OrganizationSpansFieldsEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        ):
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

            attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
                serialized["type"], AttributeKey.Type.TYPE_STRING
            )
            rpc_request = TraceItemAttributeNamesRequest(
                meta=meta,
                limit=max_span_tags,
                offset=0,
                type=attr_type,
            )

            rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

        include_internal = is_active_superuser(request) or is_active_staff(request)

        paginator = ChainPaginator(
            [
                [
                    as_tag_key(attribute.name, serialized["type"])
                    for attribute in rpc_response.attributes
                    if attribute.name
                    and can_expose_attribute_to_api(
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
