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
    build_sentry_convention_context,
    get_column_definitions,
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
from sentry.search.eap.columns import ColumnDefinitions, ResolvedAttribute
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
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
    brief = serializers.CharField(max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )
    examples = serializers.ListField(child=serializers.CharField(), required=False)


def is_sentry_defined_attribute(
    definitions: ColumnDefinitions,
    resolved_attribute: ResolvedAttribute,
    raw_attribute_key: str,
) -> bool:
    """
    Whether the attribute is defined/owned by Sentry, in which case custom
    context can't be authored for it (Sentry-owned attributes already carry
    context from their definitions / conventions metadata). An attribute is
    sentry-defined if it is:

    - a known EAP column public alias or secondary alias — ``definitions.columns``
      is keyed by public alias, and secondary aliases are stored there too;
    - a virtual context (e.g. ``project``, ``device.class``);
    - resolvable to a known column's internal name (the caller passed the
      internal name, e.g. ``sentry.op``, directly); or
    - present in the sentry conventions library, which is keyed by convention
      name and includes each convention's aliases as keys of their own (so
      passing an alias resolves to a hit here too).
    """
    if raw_attribute_key in definitions.columns or raw_attribute_key in definitions.contexts:
        return True

    known_internal_names = {column.internal_name for column in definitions.columns.values()}
    if resolved_attribute.internal_name in known_internal_names:
        return True

    return (
        build_sentry_convention_context(
            resolved_attribute.public_alias, resolved_attribute.internal_name
        )
        is not None
    )


def attribute_exists_in_storage(
    resolver: SearchResolver,
    item_type: SupportedTraceItemType,
    internal_name: str,
    attr_type: AttributeKey.Type.ValueType,
) -> bool:
    """
    Whether an attribute with the given internal name exists in storage for the
    resolver's snuba params (org/projects/time window) and attribute type.
    """
    meta = resolver.resolve_meta(referrer=resolve_attribute_referrer(item_type.value).value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )

    rpc_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=10000,
        type=attr_type,
        # An exact-name existence filter avoids the false negatives a substring +
        # single-page scan produces when many stored names share a prefix: the
        # target name appears in the response iff it exists in storage.
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
        attribute_type = cast(AttributeType, data["attribute_type"])
        trace_item_type = SupportedTraceItemType(dataset)

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

        column_definitions = get_column_definitions(trace_item_type)
        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=column_definitions,
        )

        # Resolve the raw key — a public alias, internal name, or the
        # `tags[foo,number]` tag syntax — to its canonical internal name. This is
        # what the storage layer keys on, so existence/reserved checks and the
        # upsert all operate on the same identity; equivalent forms of the same
        # attribute collapse to a single stored row.
        try:
            resolved_attribute, _ = resolver.resolve_attribute(data["attribute_key"])
        except InvalidSearchQuery as _e:
            return Response({"detail": "Invalid attribute query."}, status=400)

        internal_name = resolved_attribute.internal_name
        public_alias = resolved_attribute.public_alias

        # Sentry-defined attributes (known columns, contexts, or conventions)
        # already carry their own context, so authoring custom context for them
        # isn't allowed — only user-defined attributes are eligible.
        if is_sentry_defined_attribute(
            column_definitions, resolved_attribute, data["attribute_key"]
        ):
            return Response(
                {"detail": f"`{public_alias}` is a reserved sentry attribute."},
                status=400,
            )

        # Anything past the reserved check is a user attribute; confirm it has
        # actually been seen in storage before authoring context for it.
        attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
            attribute_type, AttributeKey.Type.TYPE_STRING
        )
        if not attribute_exists_in_storage(resolver, trace_item_type, internal_name, attr_type):
            return Response(
                {"detail": f"Attribute `{public_alias}` was not found."},
                status=400,
            )

        # `brief` is required; only persist the optional fields that were actually
        # provided so a partial update doesn't clear previously stored context.
        optional_fields = {
            field: data[field] for field in ("additional_context", "examples") if field in data
        }
        defaults = {
            "brief": data["brief"],
            "updated_by_id": request.user.id,
            **optional_fields,
        }
        # A concurrent POST for the same attribute is race-safe: the lookup kwargs
        # match the model's unique constraints, so update_or_create (via
        # get_or_create) catches the losing INSERT's IntegrityError and re-fetches
        # the winning row rather than surfacing a 500.
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
