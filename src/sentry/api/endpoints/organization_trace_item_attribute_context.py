from copy import copy
from typing import Any, Literal, Never

from django.db import router, transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEventPermission
from sentry.api.endpoints.organization_trace_item_attributes import (
    SUPPORTED_DATASETS,
    OrganizationTraceItemAttributesEndpointBase,
    full_retention_window,
    get_column_definitions,
    is_sentry_defined_attribute,
    resolve_attribute_referrer,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.trace_item_attribute_context import (
    TraceItemAttributeContextListResponse,
    TraceItemAttributeContextResponse,
    TraceItemAttributeContextSerializer,
)
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.trace_item_attribute_examples import TraceItemAttributeExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
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
from sentry.search.eap.utils import attribute_name_exists
from sentry.search.events.types import SnubaParams

AttributeType = Literal["string", "number", "boolean"]


class OrganizationTraceItemAttributeContextPutSerializer(serializers.Serializer[Never]):
    dataset = serializers.ChoiceField(
        SUPPORTED_DATASETS,
        required=False,
        help_text="The trace item dataset the attribute belongs to. Send this or `datasets`.",
    )
    datasets = serializers.ListField(
        child=serializers.ChoiceField(SUPPORTED_DATASETS),
        required=False,
        allow_empty=False,
        help_text=(
            "The trace item datasets to save the same context for, all at once. Send this "
            "or `dataset`."
        ),
    )
    attributeType = serializers.ChoiceField(
        TraceItemAttributeTypes.TYPE_NAMES,
        source="attribute_type",
        help_text="The stored type of the attribute.",
    )
    brief = serializers.CharField(
        max_length=280,
        allow_blank=True,
        allow_null=True,
        help_text=(
            "A short description of what the attribute represents. Send an empty string "
            "or null to clear it."
        ),
    )
    additionalContext = serializers.CharField(
        source="additional_context",
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Longer free-form notes about the attribute. Omit to keep the stored value.",
    )
    examples = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Example values of the attribute. Omit to keep the stored value.",
    )

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if ("dataset" in attrs) == ("datasets" in attrs):
            raise serializers.ValidationError({"dataset": "Send either `dataset` or `datasets`."})
        return attrs


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

    with handle_query_errors():
        return attribute_name_exists(meta, attr_type, internal_name)


def resolve_custom_attribute(
    snuba_params: SnubaParams, dataset: str, key: str, attribute_type: str
) -> str:
    trace_item_type = SupportedTraceItemType(dataset)

    # Existence is a property of all the org's data, so always check against
    # the full retention window and ignore any time range filters
    # (`statsPeriod`/`start`/`end`) on the request.
    params = copy(snuba_params)
    params.start, params.end = full_retention_window(trace_item_type)

    column_definitions = get_column_definitions(trace_item_type)
    resolver = SearchResolver(
        params=params,
        config=SearchResolverConfig(),
        definitions=column_definitions,
    )

    # Canonicalize the key to its internal name so every check and the upsert
    # share one identity and equivalent key forms collapse to a single row.
    try:
        resolved_attribute, _ = resolver.resolve_attribute(key)
    except InvalidSearchQuery:
        raise ParseError("Invalid attribute query.")

    internal_name = resolved_attribute.internal_name
    public_alias = resolved_attribute.public_alias

    if is_sentry_defined_attribute(resolved_attribute, column_definitions):
        raise ParseError(f"`{public_alias}` is a reserved sentry attribute in {dataset}.")

    attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
        attribute_type, AttributeKey.Type.TYPE_STRING
    )
    if not attribute_exists_in_storage(resolver, trace_item_type, internal_name, attr_type):
        raise ParseError(f"Attribute `{public_alias}` was not found in {dataset}.")

    return internal_name


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationTraceItemAttributeContextEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (OrganizationEventPermission,)

    @extend_schema(
        operation_id="updateOrganizationTraceItemAttributeContext",
        summary="Create or Update a Trace Item Attribute's Context",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="key",
                location="path",
                required=True,
                type=str,
                description="The custom attribute key to set context for.",
            ),
            OpenApiParameter(
                name="project",
                location="query",
                required=False,
                type=str,
                description=(
                    "The ID or slug of the single project to scope the context to, or `-1` "
                    "for organization-wide context. May only be omitted when the "
                    "organization has exactly one accessible project."
                ),
            ),
        ],
        request=OrganizationTraceItemAttributeContextPutSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "TraceItemAttributeContextPutResponse",
                TraceItemAttributeContextResponse | TraceItemAttributeContextListResponse,
            ),
            201: inline_sentry_response_serializer(
                "TraceItemAttributeContextPutResponse",
                TraceItemAttributeContextResponse | TraceItemAttributeContextListResponse,
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TraceItemAttributeExamples.UPDATE_TRACE_ITEM_ATTRIBUTE_CONTEXT,
    )
    def put(
        self, request: Request, organization: Organization, key: str
    ) -> (
        Response[TraceItemAttributeContextResponse | TraceItemAttributeContextListResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Create or update the authored context (a brief description, notes, and example
        values) for a custom trace item attribute. Context is scoped to a single project,
        or to the whole organization when all projects (`-1`) are requested. Sentry-defined
        attributes cannot be given custom context, and the attribute must have been seen
        in stored data. Send `datasets` to save the same context for several datasets at
        once; it returns them all as `contexts`, and saves none if any dataset is rejected.
        Returns `201` when any new context is created and `200` when only existing context
        is updated.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        # Custom context is gated; sentry conventions context is served separately.
        if not features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        ):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributeContextPutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)
        data = serializer.validated_data

        attribute_type = data["attribute_type"]
        datasets: list[str] = (
            list(dict.fromkeys(data["datasets"])) if "datasets" in data else [data["dataset"]]
        )

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

        internal_names = {
            dataset: resolve_custom_attribute(snuba_params, dataset, key, attribute_type)
            for dataset in datasets
        }

        # Only persist optional fields that were provided, so a partial update
        # doesn't clear previously stored context.
        optional_fields = {
            field: data[field] for field in ("additional_context", "examples") if field in data
        }
        defaults = {
            "brief": data["brief"] or None,
            "updated_by_id": acting_user_id(request.user),
            **optional_fields,
        }
        saved: dict[str, tuple[TraceItemAttributeContext, bool]] = {}
        with transaction.atomic(router.db_for_write(TraceItemAttributeContext)):
            # Lock rows in one fixed order, so concurrent saves can't deadlock.
            for dataset in sorted(internal_names):
                # Race-safe: the lookup kwargs match the unique constraints, so a losing
                # concurrent INSERT is caught by update_or_create rather than 500ing.
                saved[dataset] = TraceItemAttributeContext.objects.update_or_create(
                    organization=organization,
                    project=scope_project,
                    item_type=TraceItemTypes.get_id_for_type_name(dataset),
                    attribute_key=internal_names[dataset],
                    attribute_type=TraceItemAttributeTypes.get_id_for_type_name(attribute_type),
                    defaults=defaults,
                    create_defaults={
                        "additional_context": None,
                        "examples": [],
                        **defaults,
                        "created_by_id": acting_user_id(request.user),
                    },
                )

        contexts = [saved[dataset][0] for dataset in datasets]
        status = 201 if any(created for _, created in saved.values()) else 200
        response_serializer = TraceItemAttributeContextSerializer()
        body: TraceItemAttributeContextResponse | TraceItemAttributeContextListResponse
        if "datasets" in data:
            body = {"contexts": serialize(contexts, request.user, response_serializer)}
        else:
            body = serialize(contexts[0], request.user, response_serializer)
        return Response(body, status=status)
