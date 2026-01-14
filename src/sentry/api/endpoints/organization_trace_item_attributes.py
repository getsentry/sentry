from collections.abc import Callable, Sequence
from datetime import datetime, timedelta
from typing import Literal, NotRequired, TypedDict

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeValuesRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_spans_fields import BaseSpanFieldValuesAutocompletionExecutor
from sentry.api.event_search import translate_escape_sequences
from sentry.api.paginator import ChainPaginator, GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseStages
from sentry.models.releases.release_project import ReleaseProject
from sentry.search.eap import constants
from sentry.search.eap.columns import ColumnDefinitions, VirtualColumnDefinition
from sentry.search.eap.ourlogs.definitions import OURLOG_DEFINITIONS
from sentry.search.eap.preprod_size.definitions import PREPROD_SIZE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import (
    can_expose_attribute,
    get_secondary_aliases,
    is_sentry_convention_replacement_attribute,
    translate_internal_to_public_alias,
    translate_to_sentry_conventions,
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
from sentry.utils.cursors import Cursor, CursorResult


class TraceItemAttributeKey(TypedDict):
    key: str
    name: str
    secondaryAliases: NotRequired[list[str]]
    attributeSource: dict[str, str | bool]


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


class OrganizationTraceItemAttributesEndpointBase(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING
    feature_flags = [
        "organizations:ourlogs-enabled",
        "organizations:visibility-explore-view",
        "organizations:tracemetrics-enabled",
        "organizations:preprod-frontend-routes",
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
    itemType = serializers.ChoiceField(
        [e.value for e in SupportedTraceItemType], required=True, source="item_type"
    )
    attributeType = serializers.ChoiceField(
        ["string", "number", "boolean"], required=True, source="attribute_type"
    )
    substringMatch = serializers.CharField(required=False, source="substring_match")
    query = serializers.CharField(required=False)


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

    raise ValueError(f"Invalid item type: {item_type}")


def resolve_attribute_referrer(item_type: str, attribute_type: str) -> Referrer:
    if item_type == SupportedTraceItemType.SPANS.value:
        return Referrer.API_SPANS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.LOGS.value:
        return Referrer.API_LOGS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.TRACEMETRICS.value:
        return Referrer.API_TRACE_METRICS_TAG_KEYS_RPC
    elif item_type == SupportedTraceItemType.PREPROD.value:
        return Referrer.API_PREPROD_TAG_KEYS_RPC
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
    else:
        raise ValueError(f"Invalid item type: {item_type}")


def as_attribute_key(
    name: str, type: Literal["string", "number", "boolean"], item_type: SupportedTraceItemType
) -> TraceItemAttributeKey:
    public_key, public_name, attribute_source = translate_internal_to_public_alias(
        name, type, item_type
    )
    secondary_aliases = get_secondary_aliases(name, item_type)

    if public_key is not None and public_name is not None:
        pass
    elif type == "number":
        public_key = f"tags[{name},number]"
        public_name = name
    elif type == "boolean":
        public_key = f"tags[{name},boolean]"
        public_name = name
    else:
        public_key = name
        public_name = name

    serialized_source: dict[str, str | bool] = {
        "source_type": attribute_source["source_type"].value
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
    }

    if secondary_aliases:
        attribute_key["secondaryAliases"] = sorted(secondary_aliases)

    return attribute_key


ATTR_TYPE_MAP = {
    "number": AttributeKey.Type.TYPE_DOUBLE,
    "boolean": AttributeKey.Type.TYPE_BOOLEAN,
}


@region_silo_endpoint
class OrganizationTraceItemAttributesEndpoint(OrganizationTraceItemAttributesEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
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

        use_sentry_conventions = features.has(
            "organizations:performance-sentry-conventions-fields",
            organization,
            actor=request.user,
        )

        sentry_sdk.set_tag("feature.use_sentry_conventions", use_sentry_conventions)

        serialized = serializer.validated_data
        substring_match = serialized.get("substring_match", "")
        query_string = serialized.get("query")
        attribute_type = serialized.get("attribute_type")
        item_type = serialized.get("item_type")

        max_attributes = options.get("explore.trace-items.keys.max")
        value_substring_match = translate_escape_sequences(substring_match)
        trace_item_type = SupportedTraceItemType(item_type)
        referrer = resolve_attribute_referrer(trace_item_type, attribute_type)
        column_definitions = get_column_definitions(trace_item_type)
        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=column_definitions,
        )
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

        attr_type = ATTR_TYPE_MAP.get(attribute_type, AttributeKey.Type.TYPE_STRING)
        include_internal = is_active_superuser(request) or is_active_staff(request)

        def data_fn(offset: int, limit: int):
            with sentry_sdk.start_span(op="query", name="attribute_names") as span:
                rpc_request = TraceItemAttributeNamesRequest(
                    meta=meta,
                    limit=limit,
                    page_token=PageToken(offset=offset),
                    type=attr_type,
                    value_substring_match=value_substring_match,
                    intersecting_attributes_filter=query_filter,
                )

                with handle_query_errors():
                    rpc_response = snuba_rpc.attribute_names_rpc(rpc_request)

                if use_sentry_conventions:
                    attribute_keys = {}
                    for attribute in rpc_response.attributes:
                        if attribute.name and can_expose_attribute(
                            attribute.name,
                            trace_item_type,
                            include_internal=include_internal,
                        ):
                            attr_key = as_attribute_key(
                                attribute.name,
                                serialized["attribute_type"],
                                trace_item_type,
                            )
                            public_alias = attr_key["name"]
                            replacement = translate_to_sentry_conventions(
                                public_alias, trace_item_type
                            )
                            if public_alias != replacement:
                                attr_key = as_attribute_key(
                                    replacement,
                                    serialized["attribute_type"],
                                    trace_item_type,
                                )

                            attribute_keys[attr_key["name"]] = attr_key

                    attributes = list(attribute_keys.values())
                    sentry_sdk.set_context("api_response", {"attributes": attributes})
                    return attributes

                attributes = list(
                    filter(
                        lambda x: not is_sentry_convention_replacement_attribute(
                            x["name"], trace_item_type
                        ),
                        [
                            as_attribute_key(
                                attribute.name,
                                serialized["attribute_type"],
                                trace_item_type,
                            )
                            for attribute in rpc_response.attributes
                            if attribute.name
                            and can_expose_attribute(
                                attribute.name,
                                trace_item_type,
                                include_internal=include_internal,
                            )
                        ],
                    )
                )
                sentry_sdk.set_context("api_response", {"attributes": attributes})
                span.set_data("attribute_count", len(attributes))
                span.set_data("attribute_type", attribute_type)
                return attributes

        return self.paginate(
            request=request,
            paginator=TraceItemAttributesNamesPaginator(data_fn=data_fn),
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_attributes,
            max_per_page=max_attributes,
        )


@region_silo_endpoint
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

        serialized = serializer.validated_data
        item_type = serialized.get("item_type")
        substring_match = serialized.get("substring_match", "")

        max_attribute_values = options.get("explore.trace-items.values.max")

        definitions = get_column_definitions(SupportedTraceItemType(item_type))

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
            tag_values.sort(key=lambda tag: tag.value or "")
            return tag_values

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
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
        limit: int,
        offset: int,
        definitions: ColumnDefinitions,
    ):
        super().__init__(organization, snuba_params, key, query, limit)
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
        if self.context_definition:
            context = self.context_definition.constructor(self.snuba_params)
            values = [context.value_map.get(value, value) for value in values]

        return [
            TagValue(
                key=self.key,
                value=value,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for value in values
            if value
        ]


def adjust_start_end_window(start_date: datetime, end_date: datetime) -> tuple[datetime, datetime]:
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return start_date, end_date
