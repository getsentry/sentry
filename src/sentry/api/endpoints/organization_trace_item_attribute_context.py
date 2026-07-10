from typing import Literal, Never, cast

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, TraceItemFilter

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
    get_column_definitions,
    is_known_attribute,
    resolve_attribute_referrer,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.trace_item_attribute_context import (
    TraceItemAttributeContextSerializer,
)
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.utils import snuba_rpc

AttributeType = Literal["string", "number", "boolean"]


class OrganizationTraceItemAttributeContextPutSerializer(serializers.Serializer[Never]):
    dataset = serializers.ChoiceField(SUPPORTED_DATASETS)
    attributeType = serializers.ChoiceField(POSSIBLE_ATTRIBUTE_TYPES, source="attribute_type")
    brief = serializers.CharField(max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )
    examples = serializers.ListField(child=serializers.CharField(), required=False)


def attribute_exists_in_storage(
    resolver: SearchResolver,
    item_type: SupportedTraceItemType,
    internal_name: str,
    attr_type: AttributeKey.Type.ValueType,
) -> bool:
    """Whether the internal name exists in storage for the resolver's params and type."""
    meta = resolver.resolve_meta(referrer=resolve_attribute_referrer(item_type.value).value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )

    rpc_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=10000,
        type=attr_type,
        # Exact-name filter, so a shared prefix can't cause a false negative.
        intersecting_attributes_filter=TraceItemFilter(
            exists_filter=ExistsFilter(key=AttributeKey(type=attr_type, name=internal_name))
        ),
    )
    with handle_query_errors():
        rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

    return any(attribute.name == internal_name for attribute in rpc_response.attributes)


@cell_silo_endpoint
class OrganizationTraceItemAttributeContextEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def put(self, request: Request, organization: Organization, key: str) -> Response:
        """Create or update the authored context for a custom trace item attribute."""
        if not self.has_feature(organization, request):
            return Response(status=404)

        # Custom context is gated; sentry conventions context is served separately.
        if not features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        ):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributeContextPutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        dataset = data["dataset"]
        attribute_type = cast(AttributeType, data["attribute_type"])
        trace_item_type = SupportedTraceItemType(dataset)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"detail": "No projects available."}, status=400)

        # Scope to a single project, or org-wide for the all-projects sentinel
        # (`-1`/`$all`); no subset in between.
        if self.get_requested_project_params_unchecked(request).has_all_projects_sentinel:
            scope_project = None
        elif len(snuba_params.projects) == 1:
            scope_project = snuba_params.projects[0]
        else:
            return Response(
                {
                    "detail": "Pass a single `project`, or all projects "
                    "(`-1`/`$all`) for organization-wide context."
                },
                status=400,
            )

        adjusted_start, adjusted_end = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start
        snuba_params.end = adjusted_end

        column_definitions = get_column_definitions(trace_item_type)
        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=column_definitions,
        )

        # Canonicalize the key to its internal name so every check and the upsert
        # share one identity and equivalent key forms collapse to a single row.
        try:
            resolved_attribute, _ = resolver.resolve_attribute(key)
        except InvalidSearchQuery as _e:
            return Response({"detail": "Invalid attribute query."}, status=400)

        internal_name = resolved_attribute.internal_name
        public_alias = resolved_attribute.public_alias

        # Only user-defined attributes are eligible; Sentry-owned ones are reserved.
        # Check both resolved forms, since conventions may key on either.
        if is_known_attribute(public_alias, column_definitions) or is_known_attribute(
            internal_name, column_definitions
        ):
            return Response(
                {"detail": f"`{public_alias}` is a reserved sentry attribute."},
                status=400,
            )

        # Confirm the user attribute has actually been seen in storage.
        attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
            attribute_type, AttributeKey.Type.TYPE_STRING
        )
        if not attribute_exists_in_storage(resolver, trace_item_type, internal_name, attr_type):
            return Response(
                {"detail": f"Attribute `{public_alias}` was not found."},
                status=400,
            )

        # Only persist optional fields that were provided, so a partial update
        # doesn't clear previously stored context.
        optional_fields = {
            field: data[field] for field in ("additional_context", "examples") if field in data
        }
        defaults = {
            "brief": data["brief"],
            "updated_by_id": request.user.id,
            **optional_fields,
        }
        # Race-safe: the lookup kwargs match the unique constraints, so a losing
        # concurrent INSERT is caught by update_or_create rather than 500ing.
        context, created = TraceItemAttributeContext.objects.update_or_create(
            organization=organization,
            project=scope_project,
            item_type=TraceItemTypes.get_id_for_type_name(dataset),
            attribute_key=internal_name,
            attribute_type=TraceItemAttributeTypes.get_id_for_type_name(attribute_type),
            defaults=defaults,
            create_defaults={
                "additional_context": None,
                "examples": [],
                **defaults,
                "created_by_id": request.user.id,
            },
        )

        return Response(
            serialize(context, request.user, TraceItemAttributeContextSerializer()),
            status=201 if created else 200,
        )
