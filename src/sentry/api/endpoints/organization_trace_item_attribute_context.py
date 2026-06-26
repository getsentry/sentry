from typing import Literal, Never, cast

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    SUPPORTED_DATASETS,
    OrganizationTraceItemAttributesEndpointBase,
    adjust_start_end_window,
    build_sentry_convention_context,
    get_column_definitions,
    resolve_attribute_referrer,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.trace_item_attribute_context import (
    TraceItemAttributeContextSerializer,
)
from sentry.api.utils import handle_query_errors
from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import (
    PUBLIC_ALIAS_TO_INTERNAL_MAPPING,
    translate_internal_to_public_alias,
)
from sentry.search.events.types import SnubaParams
from sentry.utils import snuba_rpc

AttributeType = Literal["string", "number", "boolean"]

# Cap matches the trace item attribute validate endpoint.
MAX_ATTRIBUTE_KEY_LENGTH = 300


class OrganizationTraceItemAttributeContextPostSerializer(serializers.Serializer[Never]):
    attributeKey = serializers.CharField(
        source="attribute_key", max_length=MAX_ATTRIBUTE_KEY_LENGTH
    )
    dataset = serializers.ChoiceField(SUPPORTED_DATASETS)
    attributeType = serializers.ChoiceField(POSSIBLE_ATTRIBUTE_TYPES, source="attribute_type")
    brief = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )
    examples = serializers.ListField(child=serializers.CharField(), required=False, default=list)


def is_sentry_convention_attribute(
    attribute_key: str,
    item_type: SupportedTraceItemType,
) -> bool:
    """
    Whether ``attribute_key`` (a public alias or internal name) maps to a known
    sentry convention. Convention attributes already carry context from the
    conventions metadata, so custom context cannot be authored for them.
    """
    resolved = PUBLIC_ALIAS_TO_INTERNAL_MAPPING.get(item_type, {}).get(attribute_key)
    internal_name = resolved.internal_name if resolved else attribute_key
    return build_sentry_convention_context(attribute_key, internal_name) is not None


def attribute_exists(
    snuba_params: SnubaParams,
    item_type: SupportedTraceItemType,
    attribute_key: str,
    attribute_type: AttributeType,
) -> bool:
    """
    Whether an attribute named ``attribute_key`` exists in storage for the given
    snuba params (org/projects/time window) and item/attribute type.
    """
    column_definitions = get_column_definitions(item_type)
    resolver = SearchResolver(
        params=snuba_params,
        config=SearchResolverConfig(),
        definitions=column_definitions,
    )
    meta = resolver.resolve_meta(referrer=resolve_attribute_referrer(item_type.value).value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )
    attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
        attribute_type, AttributeKey.Type.TYPE_STRING
    )

    rpc_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=1000,
        page_token=PageToken(offset=0),
        type=attr_type,
        # Substring match narrows the scan; we still require an exact match below.
        value_substring_match=attribute_key,
    )
    with handle_query_errors():
        rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

    for attribute in rpc_response.attributes:
        if not attribute.name:
            continue
        if attribute.name == attribute_key:
            return True
        # The RPC returns internal names; the caller passes a public alias, so
        # compare against the translated public alias too.
        public_key, public_name, _ = translate_internal_to_public_alias(
            attribute.name, attribute_type, item_type
        )
        if attribute_key in (public_key, public_name):
            return True
    return False


@cell_silo_endpoint
class OrganizationTraceItemAttributeContextEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create or update the human/agent authored context (brief, examples, notes)
        for a custom trace item attribute.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        # Custom attribute context is gated by the data-browsing-attribute-context
        # feature (sentry conventions context is served separately and ungated).
        if not features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        ):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributeContextPostSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        dataset = data["dataset"]
        attribute_key = data["attribute_key"]
        attribute_type = cast(AttributeType, data["attribute_type"])
        trace_item_type = SupportedTraceItemType(dataset)

        # Convention attributes already carry context from the conventions
        # metadata, so authoring custom context for them isn't allowed.
        if is_sentry_convention_attribute(attribute_key, trace_item_type):
            return Response(
                {"detail": f"`{attribute_key}` is a sentry convention attribute."},
                status=400,
            )

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"detail": "No projects available."}, status=400)

        # The context is scoped to a single project, or org-wide when `project=-1`
        # is passed. The model can't represent a subset of projects.
        if "-1" in request.GET.getlist("project"):
            scope_project = None
        elif len(snuba_params.projects) == 1:
            scope_project = snuba_params.projects[0]
        else:
            return Response(
                {
                    "detail": "Pass a single `project`, or `project=-1` for "
                    "organization-wide context."
                },
                status=400,
            )

        adjusted_start, adjusted_end = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start
        snuba_params.end = adjusted_end

        if not attribute_exists(snuba_params, trace_item_type, attribute_key, attribute_type):
            return Response(
                {"detail": f"Attribute `{attribute_key}` was not found."},
                status=400,
            )

        defaults = {
            "brief": data.get("brief"),
            "additional_context": data.get("additional_context"),
            "examples": data.get("examples", []),
            "updated_by_id": request.user.id,
        }
        context, created = TraceItemAttributeContext.objects.update_or_create(
            organization=organization,
            project=scope_project,
            item_type=TraceItemTypes.get_id_for_type_name(dataset),
            attribute_key=attribute_key,
            attribute_type=TraceItemAttributeTypes.get_id_for_type_name(attribute_type),
            defaults=defaults,
            create_defaults={**defaults, "created_by_id": request.user.id},
        )

        return Response(
            serialize(context, request.user, TraceItemAttributeContextSerializer()),
            status=201 if created else 200,
        )
