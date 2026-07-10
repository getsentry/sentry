from collections.abc import Callable, Sequence
from datetime import datetime, timedelta
from typing import Any, Literal

import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from google.protobuf.json_format import MessageToDict
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_conventions.attributes import ATTRIBUTE_METADATA
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
    TraceItemAttributeValuesRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import (
    PageToken,
    RequestMeta,
)
from sentry_protos.snuba.v1.request_common_pb2 import (
    TraceItemType as ProtoTraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    ExistsFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_trace_item_attributes_types import (
    TraceItemAttributeContext,
    TraceItemAttributeKey,
    TraceItemAttributeSource,
)
from sentry.api.event_search import translate_escape_sequences
from sentry.api.paginator import ChainPaginator, GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.trace_item_attribute_examples import TraceItemAttributeExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.models.releases.release_project import ReleaseProject
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ColumnDefinitions,
    ResolvedAttribute,
    VirtualColumnDefinition,
)
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.preprod_size.definitions import PREPROD_SIZE_DEFINITIONS
from sentry.search.eap.processing_errors.definitions import PROCESSING_ERROR_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import (
    AttributeSourceType,
    SearchResolverConfig,
    SupportedTraceItemType,
)
from sentry.search.eap.utils import (
    can_expose_attribute_to_api,
    get_secondary_aliases,
    is_sentry_convention_replacement_attribute,
    translate_internal_to_public_alias,
)
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.filter import _flip_field_sort
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.tagstore.types import TagValue
from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.tracing import set_span_data, start_span

POSSIBLE_ATTRIBUTE_TYPES = ["string", "number", "boolean"]

# Subset of SupportedTraceItemType that get_column_definitions handles.
SUPPORTED_DATASETS = [
    SupportedTraceItemType.SPANS.value,
    SupportedTraceItemType.LOGS.value,
    SupportedTraceItemType.TRACEMETRICS.value,
    SupportedTraceItemType.PREPROD.value,
    SupportedTraceItemType.PROCESSING_ERRORS.value,
]


class ProxyResolvedAttribute(ResolvedAttribute):
    pass


class TraceItemAttributesNamesPaginator:
    """
    This is a bit of a weird paginator.

    The trace item attributes RPC returns a list of attribute names from the
    database. But depending on the item type, it is possible that there are some
    hard coded attribute names that gets appended to the end of the results.
    Because of that, the number of results returned can exceed limit + 1.

    To handle this nicely, here we choose to return the full set of results
    even if it exceeds limit + 1.
    """

    def __init__(self, data_fn):
        self.data_fn = data_fn

    def get_result(self, limit, cursor=None):
        if limit <= 0:
            raise ValueError(f"invalid limit for paginator, expected >0, got {limit}")

        offset = cursor.offset if cursor is not None else 0
        # Request 1 more than limit so we can tell if there is another page
        data = self.data_fn(offset=offset, limit=limit + 1)
        assert isinstance(data, list)
        has_more = len(data) >= limit + 1

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )


DATASET_QUERY_PARAM = OpenApiParameter(
    name="dataset",
    location="query",
    required=False,
    type=str,
    enum=SUPPORTED_DATASETS,
    description="The trace item dataset to list attributes for. One of `itemType` or `dataset` is required.",
)

ITEM_TYPE_QUERY_PARAM = OpenApiParameter(
    name="itemType",
    location="query",
    required=False,
    type=str,
    enum=SUPPORTED_DATASETS,
    deprecated=True,
    description="Deprecated alias of `dataset`. Use `dataset` instead.",
)

ATTRIBUTE_TYPE_QUERY_PARAM = OpenApiParameter(
    name="attributeType",
    location="query",
    required=False,
    many=True,
    type=str,
    enum=POSSIBLE_ATTRIBUTE_TYPES,
    description="Filter to attributes of one or more types. Defaults to all types.",
)

SUBSTRING_MATCH_QUERY_PARAM = OpenApiParameter(
    name="substringMatch",
    location="query",
    required=False,
    type=str,
    description="Restrict results to attribute names containing this substring (case-sensitive).",
)

SEARCH_QUERY_PARAM = OpenApiParameter(
    name="query",
    location="query",
    required=False,
    type=str,
    description="Sentry [search syntax](https://docs.sentry.io/concepts/search/) to filter trace items before computing attributes.",
)

EXPAND_QUERY_PARAM = OpenApiParameter(
    name="expand",
    location="query",
    required=False,
    many=True,
    type=str,
    enum=["context"],
    # Internal-only for now (context is currently limited to sentry conventions;
    # custom attribute context is still to come), so exclude it from the public
    # OpenAPI spec.
    exclude=True,
    description=(
        "Optional fields to expand. Pass `context` to include the sentry "
        "conventions metadata (brief, examples, deprecation, etc.) for "
        "attributes that map to a known convention."
    ),
)


class OrganizationTraceItemAttributesEndpointBase(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING
    feature_flags = [
        "organizations:ourlogs-enabled",
        "organizations:visibility-explore-view",
        "organizations:tracemetrics-enabled",
    ]

    def has_feature(self, organization: Organization, request: Request) -> bool:
        batch_features = features.batch_has(
            self.feature_flags, organization=organization, actor=request.user
        )

        if batch_features is None:
            return False

        key = f"organization:{organization.id}"
        org_features = batch_features.get(key, {})

        return any(org_features.get(feature) for feature in self.feature_flags)


class OrganizationTraceItemAttributesEndpointSerializer(serializers.Serializer):
    itemType = serializers.ChoiceField(SUPPORTED_DATASETS, required=False, source="item_type")
    dataset = serializers.ChoiceField(SUPPORTED_DATASETS, required=False)
    attributeType = serializers.MultipleChoiceField(
        choices=POSSIBLE_ATTRIBUTE_TYPES,
        required=False,
        source="attribute_type",
    )
    substringMatch = serializers.CharField(required=False, source="substring_match")
    query = serializers.CharField(required=False)
    expand = serializers.MultipleChoiceField(choices=["context"], required=False)

    def validate(self, attrs: Any) -> Any:
        if attrs.get("item_type") is None and attrs.get("dataset") is None:
            raise serializers.ValidationError("dataset is required if itemType is not passed")
        return attrs


def is_valid_item_type(item_type: str) -> bool:
    return item_type in [e.value for e in SupportedTraceItemType]


def get_column_definitions(item_type: SupportedTraceItemType) -> ColumnDefinitions:
    if item_type == SupportedTraceItemType.SPANS:
        return SPAN_DEFINITIONS
    elif item_type == SupportedTraceItemType.LOGS:
        return OURLOG_DEFINITIONS
    elif item_type == SupportedTraceItemType.TRACEMETRICS:
        return TRACE_METRICS_DEFINITIONS
    elif item_type == SupportedTraceItemType.PREPROD:
        return PREPROD_SIZE_DEFINITIONS
    elif item_type == SupportedTraceItemType.PROCESSING_ERRORS:
        return PROCESSING_ERROR_DEFINITIONS

    raise ValueError(f"Invalid item type: {item_type}")


def resolve_attribute_referrer(item_type: str) -> Referrer:
    if item_type == SupportedTraceItemType.SPANS.value:
        return Referrer.API_SPANS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.LOGS.value:
        return Referrer.API_LOGS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.TRACEMETRICS.value:
        return Referrer.API_TRACE_METRICS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.PREPROD.value:
        return Referrer.API_PREPROD_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.PROCESSING_ERRORS.value:
        return Referrer.API_PROCESSING_ERRORS_TAG_KEYS_RPC
    else:
        raise ValueError(f"Invalid item type: {item_type}")


def resolve_attribute_values_referrer(item_type: str) -> Referrer:
    if item_type == SupportedTraceItemType.SPANS.value:
        return Referrer.API_SPANS_TAG_VALUES_RPC
    elif item_type == SupportedTraceItemType.LOGS.value:
        return Referrer.API_LOGS_TAG_VALUES_RPC
    elif item_type == SupportedTraceItemType.TRACEMETRICS.value:
        return Referrer.API_TRACE_METRICS_TAG_VALUES_RPC
    elif item_type == SupportedTraceItemType.PREPROD.value:
        return Referrer.API_PREPROD_TAG_VALUES_RPC
    elif item_type == SupportedTraceItemType.PROCESSING_ERRORS.value:
        return Referrer.API_PROCESSING_ERRORS_TAG_VALUES_RPC
    else:
        raise ValueError(f"Invalid item type: {item_type}")


# Maps sentry-convention attribute types to EAP search types. Array and "any"
# convention types aren't representable as a single search type, so they're
# omitted and treated as "no type constraint" when matching.
_CONVENTION_TYPE_TO_SEARCH_TYPE: dict[str, str] = {
    "string": "string",
    "boolean": "boolean",
    "integer": "number",
    "double": "number",
}


SENTRY_ALWAYS_INCLUDED_ATTRIBUTES: dict[SupportedTraceItemType, frozenset[str]] = {
    SupportedTraceItemType.SPANS: frozenset({"span.description"}),
    SupportedTraceItemType.LOGS: frozenset({"message"}),
    SupportedTraceItemType.TRACEMETRICS: frozenset(),
}


def _search_type_to_context_type(search_type: str) -> Literal["string", "number", "boolean"]:
    """Collapse an EAP search type to the coarse type used for context matching."""
    if search_type == "string":
        return "string"
    if search_type == "boolean":
        return "boolean"
    return "number"


def build_sentry_convention_context(
    public_name: str,
    internal_name: str,
    attribute_type: Literal["string", "number", "boolean"] | None = None,
) -> TraceItemAttributeContext | None:
    """
    Build the sentry conventions context for an attribute, if it maps to a known
    convention. Only fields actually present in the conventions metadata are
    included.

    A convention may be keyed in ``ATTRIBUTE_METADATA`` by either the public
    alias or the internal name (see
    ``_update_attribute_definitions_with_deprecations`` in
    ``search/eap/spans/attributes.py``), so we try the public name first and
    fall back to the internal name. The lookup is purely by name and does not
    depend on the attribute's source, so conventions defined in
    ``sentry_conventions`` but not in ``attributes.py`` (e.g. ``http.route``)
    still resolve.

    When ``attribute_type`` is provided, the convention only matches if its
    expected type is compatible, so a custom attribute that merely shares a name
    with a convention but has a different type isn't treated as that convention.
    """
    metadata = ATTRIBUTE_METADATA.get(public_name) or ATTRIBUTE_METADATA.get(internal_name)
    if metadata is None:
        return None

    if attribute_type is not None:
        expected_type = _CONVENTION_TYPE_TO_SEARCH_TYPE.get(metadata.type.value)
        if expected_type is not None and expected_type != attribute_type:
            return None

    deprecation = metadata.deprecation

    # isConvention, brief and isDeprecated are always present for a known
    # convention.
    context: TraceItemAttributeContext = {
        "isConvention": True,
        "brief": metadata.brief,
        "isDeprecated": bool(
            deprecation is not None and (deprecation.status is not None or deprecation.replacement)
        ),
    }

    if metadata.additional_context:
        context["details"] = (
            list(metadata.additional_context)
            if isinstance(metadata.additional_context, (list, tuple))
            else [metadata.additional_context]
        )

    if metadata.example is not None:
        context["examples"] = (
            list(metadata.example)
            if isinstance(metadata.example, (list, tuple))
            else [metadata.example]
        )

    if deprecation is not None and deprecation.replacement:
        context["replacementAttribute"] = deprecation.replacement

    return context


def build_sentry_attribute_context(
    public_name: str,
    attribute_type: Literal["string", "number", "boolean"] | None,
    item_type: SupportedTraceItemType,
) -> TraceItemAttributeContext | None:
    """
    Build context for a Sentry-defined (non-convention) attribute from its
    definition's ``context``. Falls back to virtual column definitions (e.g.
    ``project``) so their briefs surface too. When ``attribute_type`` is given,
    context only attaches if it matches, so a user tag sharing a public alias
    isn't mislabeled.
    """
    definitions = get_column_definitions(item_type)
    column = definitions.columns.get(public_name) or definitions.contexts.get(public_name)
    context = getattr(column, "context", None)
    if column is None or context is None or column.secondary_alias:
        return None

    if (
        attribute_type is not None
        and _search_type_to_context_type(column.search_type) != attribute_type
    ):
        return None

    # Virtual column definitions don't carry deprecation metadata.
    replacement = getattr(column, "replacement", None)
    deprecation_status = getattr(column, "deprecation_status", None)

    result: TraceItemAttributeContext = {
        "isConvention": False,
        "brief": context.brief,
        "isDeprecated": bool(deprecation_status or replacement),
    }
    if context.examples:
        result["examples"] = list(context.examples)
    if replacement:
        result["replacementAttribute"] = replacement
    return result


def is_known_attribute(name: str, definitions: ColumnDefinitions) -> bool:
    """
    Whether ``name`` is an attribute Sentry defines — a column public/secondary
    alias, a virtual context, a column internal name, or a sentry-conventions
    entry (keyed by either public or internal name). Custom names resolve to
    none of these and return False.
    """
    if name in definitions.columns or name in definitions.contexts:
        return True
    if name in {column.internal_name for column in definitions.columns.values()}:
        return True
    return ATTRIBUTE_METADATA.get(name) is not None


def as_attribute_key(
    name: str,
    attr_type: Literal["string", "number", "boolean"],
    item_type: SupportedTraceItemType,
    is_proxy: bool = False,
    include_context: bool = False,
) -> TraceItemAttributeKey:
    public_key, public_name, attribute_source = translate_internal_to_public_alias(
        name, attr_type, item_type
    )
    secondary_aliases = get_secondary_aliases(name, item_type)

    if public_key is not None and public_name is not None:
        pass
    elif is_proxy:
        public_key = public_name = name
    elif attr_type == "number":
        public_key = f"tags[{name},number]"
        public_name = name
    elif attr_type == "boolean":
        public_key = f"tags[{name},boolean]"
        public_name = name
    else:
        public_key = name
        public_name = name

    serialized_source: TraceItemAttributeSource = {
        "source_type": (
            attribute_source["source_type"].value
            if not is_proxy
            else AttributeSourceType.SENTRY.value
        )
    }
    if attribute_source.get("is_transformed_alias"):
        serialized_source["is_transformed_alias"] = True

    attribute_key: TraceItemAttributeKey = {
        # key is what will be used to query the API
        "key": public_key,
        # name is what will be used to display the tag nicely in the UI
        "name": public_name,
        # source of the attribute, used to determine whether to show the sentry icon etc. and helps delineate between sentry and user attributes when the names are identical
        # eg. sentry.environment and environment set by the user both have the same alias (name).
        "attributeSource": serialized_source,
        "attributeType": attr_type,
    }

    if secondary_aliases:
        attribute_key["secondaryAliases"] = sorted(secondary_aliases)

    if include_context:
        # When context is requested we always attach it. We match against the
        # sentry conventions by name and type regardless of source_type, because
        # `source_type` reflects who set the attribute (SDK vs user), not whether
        # it maps to a convention. `attributes.py` only lists conventions that
        # need an alias (a public name distinct from their internal name), so a
        # convention whose name is already the same internally -- e.g.
        # `http.route` -- is missing from it and resolves as a `user` source
        # attribute. A Sentry-defined attribute that isn't a convention (e.g.
        # `span.description`) instead carries its context on the definition. User
        # attributes with no match get an empty context.
        context = build_sentry_convention_context(
            public_name, name, attr_type
        ) or build_sentry_attribute_context(public_name, attr_type, item_type)
        attribute_key["context"] = context or {}

    return attribute_key


def can_expose_trace_item_attribute_to_api(
    attribute_key: TraceItemAttributeKey,
    item_type: SupportedTraceItemType,
    include_internal: bool = False,
) -> bool:
    return can_expose_attribute_to_api(
        attribute_key["key"],
        item_type,
        include_internal=include_internal,
    ) and can_expose_attribute_to_api(
        attribute_key["name"],
        item_type,
        include_internal=include_internal,
    )


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationTraceItemAttributesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listOrganizationTraceItemAttributes",
        summary="List Trace Item Attributes",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            DATASET_QUERY_PARAM,
            ITEM_TYPE_QUERY_PARAM,
            ATTRIBUTE_TYPE_QUERY_PARAM,
            SUBSTRING_MATCH_QUERY_PARAM,
            SEARCH_QUERY_PARAM,
            EXPAND_QUERY_PARAM,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListTraceItemAttributesResponse", list[TraceItemAttributeKey]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TraceItemAttributeExamples.LIST_TRACE_ITEM_ATTRIBUTES,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[TraceItemAttributeKey]] | Response[ValidationErrorResponse]:
        """
        List the attribute keys available on a given trace item dataset (spans, logs,
        trace metrics, etc.), with optional substring and structured filtering.
        """
        if not self.has_feature(organization, request):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributesEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

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
        attribute_types = serialized.get("attribute_type")
        # When not passed the user wants all types
        if attribute_types is None or len(attribute_types) == 0:
            attribute_types = POSSIBLE_ATTRIBUTE_TYPES
        # Deprecating this so we're using the same param name as the events endpoints
        item_type = serialized.get("item_type")
        # Dataset is going to replace item_type
        dataset = serialized.get("dataset")
        if dataset is None:
            dataset = item_type

        max_attributes = options.get("explore.trace-items.keys.max")
        trace_item_type = SupportedTraceItemType(dataset)
        referrer = resolve_attribute_referrer(trace_item_type)
        column_definitions = get_column_definitions(trace_item_type)
        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=column_definitions,
        )
        with handle_query_errors():
            query_filter, _, _ = resolver.resolve_query(query_string)
        meta = resolver.resolve_meta(referrer=referrer.value)
        meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
            trace_item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
        )

        adjusted_start_date, adjusted_end_date = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start_date
        snuba_params.end = adjusted_end_date

        include_internal = is_active_superuser(request) or is_active_staff(request)
        debug = request.user.is_superuser and request.GET.get("debug", False)
        debug_infos: list[dict] = []

        # Expand the sentry conventions context when explicitly requested via
        # `expand=context`. The conventions metadata is static with no data
        # implications, so it isn't gated. (Custom attribute context, planned
        # later, will be gated behind the data-browsing-attribute-context
        # feature.)
        include_context = "context" in serialized.get("expand", set())

        def data_fn(offset: int, limit: int) -> list[TraceItemAttributeKey]:
            futures = []
            with ContextPropagatingThreadPoolExecutor(
                thread_name_prefix=__name__,
                max_workers=len(POSSIBLE_ATTRIBUTE_TYPES),
            ) as pool:
                for attribute_type in attribute_types:
                    futures.append(
                        pool.submit(
                            self.query_trace_attributes,
                            offset,
                            limit,
                            meta,
                            query_filter,
                            substring_match,
                            attribute_type,
                            column_definitions,
                            trace_item_type,
                            include_internal,
                            include_context,
                            debug=debug,
                        )
                    )
            attributes = []
            for future in futures:
                result_attributes, result_debug_info = future.result()
                attributes.extend(result_attributes)
                if result_debug_info is not None:
                    debug_infos.append(result_debug_info)
            return attributes

        response = self.paginate(
            request=request,
            paginator=TraceItemAttributesNamesPaginator(data_fn=data_fn),
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attributes,
            max_per_page=max_attributes,
        )
        if debug:
            response.data = {"data": response.data, "debug_info": debug_infos}
        return response

    def query_trace_attributes(
        self,
        offset: int,
        limit: int,
        meta: RequestMeta,
        query_filter: TraceItemFilter | None,
        substring_match: str,
        attribute_type: Literal["string", "number", "boolean"],
        column_definitions: ColumnDefinitions,
        trace_item_type: SupportedTraceItemType,
        include_internal: bool,
        include_context: bool = False,
        debug: str | bool = False,
    ) -> tuple[list[TraceItemAttributeKey], dict | None]:
        debug_info: dict | None = None
        value_substring_match = translate_escape_sequences(substring_match)
        attr_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(
            attribute_type, AttributeKey.Type.TYPE_STRING
        )
        with start_span(op="filter", name="hardcoded_aliases") as span:
            all_aliased_attributes = []
            # our aliases don't exist in the db, so filter over our aliases
            # virtually page through defined aliases before we hit the db
            if offset <= len(column_definitions.columns) + len(column_definitions.contexts):
                if substring_match:
                    for column in column_definitions.columns.values():
                        if (
                            column.proto_type == attr_type
                            and substring_match in column.public_alias
                            and not column.secondary_alias
                            and not column.private
                        ):
                            all_aliased_attributes.append(column)
                    for (
                        public_label,
                        virtual_context,
                    ) in column_definitions.contexts.items():
                        if (
                            substring_match in public_label
                            and virtual_context.search_type is not None
                            and not virtual_context.secondary_alias
                            and constants.TYPE_MAP[virtual_context.search_type] == attr_type
                        ):
                            all_aliased_attributes.append(
                                ProxyResolvedAttribute(
                                    public_alias=public_label,
                                    internal_name=public_label,
                                    search_type=virtual_context.search_type,
                                )
                            )
                else:
                    # Always include curated Sentry-defined attributes (e.g.
                    # span.description) so they aren't paged out past the RPC's
                    # attribute-name limit. They carry context and
                    # source_type=sentry.
                    for public_alias in SENTRY_ALWAYS_INCLUDED_ATTRIBUTES.get(
                        trace_item_type, frozenset()
                    ):
                        always_include_column = column_definitions.columns.get(public_alias)
                        if (
                            always_include_column is not None
                            and always_include_column.proto_type == attr_type
                            and not always_include_column.secondary_alias
                            and not always_include_column.private
                        ):
                            all_aliased_attributes.append(always_include_column)
                    for (
                        public_label,
                        virtual_context,
                    ) in column_definitions.contexts.items():
                        if (
                            substring_match in public_label
                            and virtual_context.search_type is not None
                            and not virtual_context.secondary_alias
                            and constants.TYPE_MAP[virtual_context.search_type] == attr_type
                        ):
                            all_aliased_attributes.append(
                                ProxyResolvedAttribute(
                                    public_alias=public_label,
                                    internal_name=public_label,
                                    search_type=virtual_context.search_type,
                                )
                            )
            aliased_attributes = all_aliased_attributes[offset : offset + limit]
        with start_span(op="query", name="attribute_names") as span:
            if len(aliased_attributes) < limit:
                offset -= len(all_aliased_attributes) - len(aliased_attributes)
                limit -= len(aliased_attributes)
                rpc_request = TraceItemAttributeNamesRequest(
                    meta=meta,
                    limit=limit,
                    page_token=PageToken(offset=offset),
                    type=attr_type,
                    value_substring_match=value_substring_match,
                    intersecting_attributes_filter=query_filter,
                )

                with handle_query_errors():
                    rpc_response = snuba_rpc.attribute_names_rpc(rpc_request, debug=debug)
                    if debug:
                        debug_info = {
                            "attribute_type": attribute_type,
                            "raw_request": MessageToDict(rpc_request),
                            "raw_response": MessageToDict(rpc_response),
                        }
            else:
                rpc_response = TraceItemAttributeNamesResponse()

        with start_span(op="query", name="serialize") as span:
            attributes = self.serialize_trace_attributes(
                rpc_response,
                attribute_type,
                trace_item_type,
                include_internal,
                substring_match,
                aliased_attributes,
                all_aliased_attributes,
                include_context,
            )

            sentry_sdk.set_context("api_response", {"attributes": attributes})
            sentry_sdk.set_attribute("api_response.attributes", str(attributes))
            set_span_data(span, "attribute_count", len(attributes))
            set_span_data(span, "attribute_type", attribute_type)
        return attributes, debug_info

    def serialize_trace_attributes(
        self,
        rpc_response: TraceItemAttributeNamesResponse,
        attribute_type: Literal["string", "number", "boolean"],
        trace_item_type: SupportedTraceItemType,
        include_internal: bool,
        substring_match: str,
        aliased_attributes: list[ResolvedAttribute | ProxyResolvedAttribute],
        exclude_attributes: list[ResolvedAttribute | ProxyResolvedAttribute],
        include_context: bool = False,
    ) -> list[TraceItemAttributeKey]:
        attribute_keys = {}
        for attribute in rpc_response.attributes:
            if attribute.name and can_expose_attribute_to_api(
                attribute.name,
                trace_item_type,
                include_internal=include_internal,
            ):
                attr_key = as_attribute_key(
                    attribute.name,
                    attribute_type,
                    trace_item_type,
                    include_context=include_context,
                )
                if (
                    not is_sentry_convention_replacement_attribute(
                        attr_key["name"], trace_item_type
                    )
                    # Remove anything where the public alias doesn't match the substring
                    # This can happen when the public alias is different, but that's handled by
                    # aliased_attributes
                    and (substring_match in attr_key["name"] if substring_match else True)
                    and can_expose_trace_item_attribute_to_api(
                        attr_key, trace_item_type, include_internal=include_internal
                    )
                ):
                    attribute_keys[attr_key["key"]] = attr_key
        # We need to exclude any aliased attributes here since because of pagination they might have already been seen
        # earlier
        for aliased_attr in exclude_attributes:
            attr_key = as_attribute_key(
                aliased_attr.internal_name,
                attribute_type,
                trace_item_type,
                is_proxy=isinstance(aliased_attr, ProxyResolvedAttribute),
            )
            if attr_key["name"] in attribute_keys:
                del attribute_keys[attr_key["name"]]
        for aliased_attr in aliased_attributes:
            if can_expose_attribute_to_api(
                aliased_attr.public_alias,
                trace_item_type,
                include_internal=include_internal,
            ):
                attr_key = as_attribute_key(
                    aliased_attr.internal_name,
                    attribute_type,
                    trace_item_type,
                    is_proxy=isinstance(aliased_attr, ProxyResolvedAttribute),
                    include_context=include_context,
                )
                if can_expose_attribute_to_api(
                    aliased_attr.internal_name,
                    trace_item_type,
                    include_internal=include_internal,
                ) and can_expose_trace_item_attribute_to_api(
                    attr_key, trace_item_type, include_internal=include_internal
                ):
                    attribute_keys[attr_key["key"]] = attr_key
        attributes = list(attribute_keys.values())
        sentry_sdk.set_context("api_response", {"attributes": attributes})
        sentry_sdk.set_attribute("api_response.attributes", str(attributes))
        return attributes


@cell_silo_endpoint
class OrganizationTraceItemAttributeValuesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    def get(self, request: Request, organization: Organization, key: str) -> Response:
        if not self.has_feature(organization, request):
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
        sentry_sdk.set_attribute("query.attribute_key", key)

        serialized = serializer.validated_data
        substring_match = serialized.get("substring_match", "")
        # Deprecating this so we're using the same param name as the events endpoints
        item_type = serialized.get("item_type")
        # Dataset is going to replace item_type
        dataset = serialized.get("dataset")
        if dataset is None:
            dataset = item_type

        max_attribute_values = options.get("explore.trace-items.values.max")

        definitions = get_column_definitions(SupportedTraceItemType(dataset))

        def data_fn(offset: int, limit: int):
            executor = TraceItemAttributeValuesAutocompletionExecutor(
                organization=organization,
                snuba_params=snuba_params,
                key=key,
                query=substring_match,
                limit=limit,
                offset=offset,
                definitions=definitions,
            )

            with handle_query_errors():
                tag_values = executor.execute()
            tag_values.sort(
                key=lambda tag: (
                    -tag.times_seen if tag.times_seen is not None else 0,
                    tag.value or "",
                )
            )
            return tag_values

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attribute_values,
            max_per_page=max_attribute_values,
        )


class TraceItemAttributeValuesAutocompletionExecutor:
    PROJECT_SLUG_KEYS = {"project", "project.name"}
    PROJECT_ID_KEYS = {"project.id"}

    def __init__(
        self,
        organization: Organization,
        snuba_params: SnubaParams,
        key: str,
        query: str | None,
        limit: int,
        offset: int,
        definitions: ColumnDefinitions,
    ):
        self.organization = organization
        self.snuba_params = snuba_params
        self.key = key
        self.query = query or ""
        self.limit = limit
        self.offset = offset
        self.resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=definitions
        )
        self.search_type, self.attribute_key, self.context_definition = self.resolve_attribute_key(
            key
        )
        self.autocomplete_function: dict[str, Callable[[], list[TagValue]]] = (
            {key: self.project_id_autocomplete_function for key in self.PROJECT_ID_KEYS}
            | {key: self.project_slug_autocomplete_function for key in self.PROJECT_SLUG_KEYS}
            | {
                RELEASE_STAGE_ALIAS: self.release_stage_autocomplete_function,
                SEMVER_ALIAS: self.semver_autocomplete_function,
                SEMVER_BUILD_ALIAS: self.semver_build_autocomplete_function,
                SEMVER_PACKAGE_ALIAS: self.semver_package_autocomplete_function,
                "timestamp": self.skip_autocomplete,
            }
        )

    def resolve_attribute_key(
        self, key: str
    ) -> tuple[constants.SearchType, AttributeKey, VirtualColumnDefinition | None]:
        resolved_attr, context_definition = self.resolver.resolve_attribute(key)
        if context_definition:
            resolved_attr = self.resolver.map_context_to_original_column(context_definition)
        return (
            resolved_attr.search_type,
            resolved_attr.proto_definition,
            context_definition,
        )

    def execute(self) -> list[TagValue]:
        func = self.autocomplete_function.get(self.key)

        if func is not None:
            return func()

        if self.search_type == "boolean":
            return self.boolean_autocomplete_function()

        if self.search_type == "string":
            return self.string_autocomplete_function()

        return []

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

    def release_stage_autocomplete_function(self):
        return [
            TagValue(
                key=self.key,
                value=stage.value,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for stage in ReleaseStages
            if not self.query or self.query in stage.value
        ]

    def semver_autocomplete_function(self):
        versions = Release.objects.filter(version__contains="@" + self.query)

        project_ids = self.snuba_params.project_ids
        if project_ids:
            release_projects = ReleaseProject.objects.filter(project_id__in=project_ids)
            versions = versions.filter(id__in=release_projects.values_list("release_id", flat=True))

        environment_ids = self.snuba_params.environment_ids
        if environment_ids:
            release_environments = ReleaseEnvironment.objects.filter(
                environment_id__in=environment_ids
            )
            versions = versions.filter(
                id__in=release_environments.values_list("release_id", flat=True)
            )

        order_by = map(_flip_field_sort, Release.SEMVER_COLS + ["package"])
        versions = versions.filter_to_semver()  # type: ignore[attr-defined]  # mypy doesn't know about ReleaseQuerySet
        versions = versions.annotate_prerelease_column()
        versions = versions.order_by(*order_by)

        seen = set()
        formatted_versions = []
        # We want to format versions here in a way that makes sense for autocomplete. So we
        # - Only include package if we think the user entered a package
        # - Exclude build number, since it's not used as part of filtering
        # When we don't include package, this can result in duplicate version numbers, so we
        # also de-dupe here. This can result in less than 1000 versions returned, but we
        # typically use very few values so this works ok.
        for version in versions.values_list("version", flat=True)[:1000]:
            formatted_version = version.split("@", 1)[1]
            formatted_version = formatted_version.split("+", 1)[0]
            if formatted_version in seen:
                continue

            seen.add(formatted_version)
            formatted_versions.append(
                TagValue(
                    key=self.key,
                    value=formatted_version,
                    times_seen=None,
                    first_seen=None,
                    last_seen=None,
                )
            )

        return formatted_versions

    def semver_build_autocomplete_function(self):
        build = self.query if self.query else ""
        if not build.endswith("*"):
            build += "*"

        organization_id = self.snuba_params.organization_id
        assert organization_id is not None

        versions = Release.objects.filter_by_semver_build(
            organization_id,
            "exact",
            build,
            self.snuba_params.project_ids,
        )

        environment_ids = self.snuba_params.environment_ids
        if environment_ids:
            release_environments = ReleaseEnvironment.objects.filter(
                environment_id__in=environment_ids
            )
            versions = versions.filter(
                id__in=release_environments.values_list("release_id", flat=True)
            )

        builds = (
            versions.values_list("build_code", flat=True).distinct().order_by("build_code")[:1000]
        )

        return [
            TagValue(
                key=self.key,
                value=build,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for build in builds
        ]

    def semver_package_autocomplete_function(self):
        assert self.snuba_params.organization_id is not None
        packages = (
            Release.objects.filter(
                organization_id=self.snuba_params.organization_id,
                package__startswith=self.query,
            )
            .values_list("package")
            .distinct()
        )

        versions = Release.objects.filter(
            organization_id=self.snuba_params.organization_id,
            package__in=packages,
            id__in=ReleaseProject.objects.filter(
                project_id__in=self.snuba_params.project_ids
            ).values_list("release_id", flat=True),
        ).annotate_prerelease_column()  # type: ignore[attr-defined]  # mypy doesn't know about ReleaseQuerySet

        environment_ids = self.snuba_params.environment_ids
        if environment_ids:
            release_environments = ReleaseEnvironment.objects.filter(
                environment_id__in=environment_ids
            )
            versions = versions.filter(
                id__in=release_environments.values_list("release_id", flat=True)
            )

        packages = versions.values_list("package", flat=True).distinct().order_by("package")[:1000]

        return [
            TagValue(
                key=self.key,
                value=package,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for package in packages
        ]

    def skip_autocomplete(self) -> list[TagValue]:
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
            limit=self.limit,
            page_token=PageToken(offset=self.offset),
        )
        rpc_response = snuba_rpc.attribute_values_rpc(rpc_request)

        values: Sequence[str] = rpc_response.values
        counts: Sequence[int] = rpc_response.counts
        if self.context_definition:
            context = self.context_definition.constructor(self.snuba_params, self.resolver)
            values = [context.value_map.get(value, value) for value in values]

        return [
            TagValue(
                key=self.key,
                value=value,
                times_seen=counts[index] if len(counts) == len(values) else None,
                first_seen=None,
                last_seen=None,
            )
            for index, value in enumerate(values)
            if value
        ]


def adjust_start_end_window(start_date: datetime, end_date: datetime) -> tuple[datetime, datetime]:
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return start_date, end_date


class OrganizationTraceItemAttributeValidateQuerySerializer(serializers.Serializer):
    itemType = serializers.ChoiceField(
        [e.value for e in SupportedTraceItemType], required=True, source="item_type"
    )


class OrganizationTraceItemAttributeValidateBodySerializer(serializers.Serializer):
    attributes = serializers.ListField(
        child=serializers.CharField(max_length=300),
        min_length=1,
        max_length=100,
        required=True,
    )


def serialize_type(search_type: constants.SearchType) -> str:
    proto_type = constants.TYPE_MAP.get(search_type)
    if proto_type == constants.STRING:
        return "string"
    if proto_type == constants.BOOLEAN:
        return "boolean"
    # DOUBLE, INT, or anything else numeric
    return "number"


def _check_attributes_by_type(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: list[str],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute names exist in storage for the active window."""
    if not names:
        return set()

    requested_names = set(names)
    names_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=10000,
        type=attr_type,
        intersecting_attributes_filter=TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        exists_filter=ExistsFilter(key=AttributeKey(type=attr_type, name=name))
                    )
                    for name in requested_names
                ]
            )
        ),
    )
    names_response = snuba_rpc.attribute_names_rpc(names_request)
    return {
        (attr_type, attribute.name)
        for attribute in names_response.attributes
        if attribute.name in requested_names
    }


# We want to limit the number of threads to the number of attribute types to avoid overwhelming the RPC server.
MAX_ATTRIBUTE_VALIDATION_THREADS = 3


def _check_attributes_exist(
    resolver: SearchResolver,
    item_type: SupportedTraceItemType,
    attrs_by_type: dict[AttributeKey.Type.ValueType, list[str]],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute internal names exist in storage."""
    if not attrs_by_type:
        return set()

    meta = resolver.resolve_meta(referrer=Referrer.API_TRACE_ITEM_ATTRIBUTE_VALIDATE.value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )

    found: set[tuple[AttributeKey.Type.ValueType, str]] = set()
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix="attr_validate",
        max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
    ) as pool:
        futures = [
            pool.submit(_check_attributes_by_type, meta, attr_type, names)
            for attr_type, names in attrs_by_type.items()
        ]
        for future in futures:
            found.update(future.result())

    return found


@cell_silo_endpoint
class OrganizationTraceItemAttributeValidateEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def post(self, request: Request, organization: Organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        query_serializer = OrganizationTraceItemAttributeValidateQuerySerializer(data=request.GET)
        if not query_serializer.is_valid():
            return Response(query_serializer.errors, status=400)

        serializer = OrganizationTraceItemAttributeValidateBodySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        item_type = SupportedTraceItemType(query_serializer.validated_data["item_type"])
        attribute_names: list[str] = serializer.validated_data["attributes"]

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"attributes": {}})

        try:
            definitions = get_column_definitions(item_type)
        except ValueError:
            return Response({"detail": f"Unsupported item type: {item_type.value}"}, status=400)
        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=definitions,
        )

        results: dict[str, dict[str, Any]] = {}
        # Collect unknown (user tag) attributes that need storage validation
        unknown_attrs: list[tuple[str, Any]] = []

        for attr_name in attribute_names:
            try:
                resolved, _context = resolver.resolve_attribute(attr_name)
                if attr_name in definitions.contexts or attr_name in definitions.columns:
                    # Known column or virtual context — always valid
                    results[attr_name] = {
                        "valid": True,
                        "type": serialize_type(resolved.search_type),
                    }
                else:
                    # User tag — need to verify it exists in storage
                    unknown_attrs.append((attr_name, resolved))
            except InvalidSearchQuery as e:
                results[attr_name] = {
                    "valid": False,
                    "error": str(e),
                }

        if unknown_attrs:
            # Group by proto type because the storage check is keyed on
            # (proto_type, internal_name) — the same display name can exist
            # as both a string and a number attribute simultaneously.
            attrs_by_type: dict[AttributeKey.Type.ValueType, list[str]] = {}
            for _, resolved in unknown_attrs:
                attrs_by_type.setdefault(resolved.proto_type, []).append(resolved.internal_name)
            with handle_query_errors():
                existing = _check_attributes_exist(resolver, item_type, attrs_by_type)

            for attr_name, resolved in unknown_attrs:
                if (resolved.proto_type, resolved.internal_name) in existing:
                    results[attr_name] = {
                        "valid": True,
                        "type": serialize_type(resolved.search_type),
                    }
                else:
                    results[attr_name] = {
                        "valid": False,
                        "error": f"Unknown attribute: {attr_name}",
                    }

        return Response({"attributes": results})
