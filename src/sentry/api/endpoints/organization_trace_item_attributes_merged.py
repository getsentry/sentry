from collections.abc import Callable
from typing import Any, NotRequired, TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType

from sentry import features, options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    SCALAR_ATTRIBUTE_TYPES,
    OrganizationTraceItemAttributesEndpoint,
    adjust_start_end_window,
    attach_custom_attribute_context,
    get_column_definitions,
    resolve_attribute_referrer,
)
from sentry.api.endpoints.organization_trace_item_attributes_types import (
    TraceItemAttributeContext,
    TraceItemAttributeKey,
    TraceItemAttributeSource,
)
from sentry.api.paginator import ChainPaginator, GenericOffsetPaginator
from sentry.apidocs.response_types import as_validation_errors
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import ColumnType, SearchResolverConfig, SupportedTraceItemType
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

MERGEABLE_DATASETS = [
    SupportedTraceItemType.SPANS.value,
    SupportedTraceItemType.LOGS.value,
    SupportedTraceItemType.TRACEMETRICS.value,
]


class MergedTraceItemAttribute(TypedDict):
    name: str
    attributeType: ColumnType
    attributeSource: TraceItemAttributeSource
    datasets: list[str]
    context: NotRequired[TraceItemAttributeContext]


def _brief(attribute: MergedTraceItemAttribute) -> str:
    return attribute.get("context", {}).get("brief", "")


SORT_KEYS: dict[str, Callable[[MergedTraceItemAttribute], Any]] = {
    "name": lambda attribute: (
        attribute["name"],
        attribute["attributeType"],
        attribute["attributeSource"]["source_type"],
    ),
    "type": lambda attribute: (attribute["attributeType"], attribute["name"]),
    "datasets": lambda attribute: (
        [MERGEABLE_DATASETS.index(dataset) for dataset in attribute["datasets"]],
        attribute["name"],
    ),
    "description": lambda attribute: (_brief(attribute).lower(), attribute["name"]),
}
SORT_CHOICES = [*SORT_KEYS, *(f"-{field}" for field in SORT_KEYS)]

# Matches the maxsize of the Snuba connection pool, so concurrent queries don't overflow it.
MAX_QUERY_WORKERS = 10


class OrganizationTraceItemAttributesMergedEndpointSerializer(serializers.Serializer):
    dataset = serializers.MultipleChoiceField(choices=MERGEABLE_DATASETS, required=False)
    attributeType = serializers.MultipleChoiceField(
        choices=POSSIBLE_ATTRIBUTE_TYPES,
        required=False,
        source="attribute_type",
    )
    substringMatch = serializers.CharField(required=False, source="substring_match")
    expand = serializers.MultipleChoiceField(choices=["context"], required=False)
    sort = serializers.ChoiceField(choices=SORT_CHOICES, required=False, default="name")


def sort_merged_attributes(
    attributes: list[MergedTraceItemAttribute], sort: str
) -> list[MergedTraceItemAttribute]:
    field = sort.removeprefix("-")
    descending = sort.startswith("-")
    if field != "description":
        return sorted(attributes, key=SORT_KEYS[field], reverse=descending)

    described = [attribute for attribute in attributes if _brief(attribute)]
    undescribed = [attribute for attribute in attributes if not _brief(attribute)]
    return [
        *sorted(described, key=SORT_KEYS[field], reverse=descending),
        *sorted(undescribed, key=SORT_KEYS[field], reverse=descending),
    ]


def merge_attributes_across_datasets(
    attributes_by_dataset: dict[str, list[TraceItemAttributeKey]],
) -> list[MergedTraceItemAttribute]:
    merged: dict[tuple[str, str, str], MergedTraceItemAttribute] = {}
    for dataset, attributes in attributes_by_dataset.items():
        for attribute in attributes:
            source_type = attribute["attributeSource"]["source_type"]
            merge_key = (attribute["name"], attribute["attributeType"], source_type)
            existing = merged.get(merge_key)
            if existing is None:
                merged_attribute: MergedTraceItemAttribute = {
                    "name": attribute["name"],
                    "attributeType": attribute["attributeType"],
                    "attributeSource": {"source_type": source_type},
                    "datasets": [dataset],
                }
                if "context" in attribute:
                    merged_attribute["context"] = attribute["context"]
                merged[merge_key] = merged_attribute
                continue

            if dataset not in existing["datasets"]:
                existing["datasets"].append(dataset)
            if attribute.get("context") and not existing.get("context"):
                existing["context"] = attribute["context"]

    return list(merged.values())


@cell_silo_endpoint
class OrganizationTraceItemAttributesMergedEndpoint(OrganizationTraceItemAttributesEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Each dataset's attributes are fetched in full and merged before paginating,
        since per-dataset cursors can't be combined into a single ordering.
        """
        if not features.has(
            "organizations:attribute-management", organization, actor=request.user
        ) or not self.has_feature(organization, request):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributesMergedEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            response = self.paginate(request=request, paginator=ChainPaginator([]))
            response["X-Hits"] = 0
            return response

        serialized: dict[str, Any] = serializer.validated_data
        substring_match = serialized.get("substring_match", "")
        selected_datasets = serialized.get("dataset") or MERGEABLE_DATASETS
        datasets = [dataset for dataset in MERGEABLE_DATASETS if dataset in selected_datasets]

        supports_arrays = features.has(
            "organizations:trace-item-array-query-support",
            organization,
            actor=request.user,
        )
        allowed_attribute_types = (
            POSSIBLE_ATTRIBUTE_TYPES if supports_arrays else SCALAR_ATTRIBUTE_TYPES
        )
        selected_attribute_types = serialized.get("attribute_type")
        attribute_types = [
            attribute_type
            for attribute_type in allowed_attribute_types
            if not selected_attribute_types or attribute_type in selected_attribute_types
        ]

        snuba_params.start, snuba_params.end = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )

        include_internal = is_active_superuser(request) or is_active_staff(request)
        include_internal_convention_attributes = request.user.is_staff or request.user.is_superuser
        sort = serialized["sort"]
        expand_context = "context" in serialized.get("expand", set())
        include_context = expand_context or sort.removeprefix("-") == "description"
        include_custom_context = include_context and features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        )
        max_attributes = options.get("explore.trace-items.keys.max")

        tasks = []
        for dataset in datasets:
            trace_item_type = SupportedTraceItemType(dataset)
            column_definitions = get_column_definitions(trace_item_type)
            resolver = SearchResolver(
                params=snuba_params,
                config=SearchResolverConfig(disable_array_attributes=not supports_arrays),
                definitions=column_definitions,
            )
            meta = resolver.resolve_meta(referrer=resolve_attribute_referrer(dataset).value)
            meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
                trace_item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
            )
            for attribute_type in attribute_types:
                tasks.append((dataset, trace_item_type, column_definitions, meta, attribute_type))

        attributes_by_dataset: dict[str, list[TraceItemAttributeKey]] = {
            dataset: [] for dataset in datasets
        }
        with ContextPropagatingThreadPoolExecutor(
            thread_name_prefix=__name__,
            max_workers=max(min(len(tasks), MAX_QUERY_WORKERS), 1),
        ) as pool:
            futures = [
                (
                    dataset,
                    pool.submit(
                        self.query_trace_attributes,
                        0,
                        max_attributes,
                        meta,
                        None,
                        substring_match,
                        attribute_type,
                        column_definitions,
                        trace_item_type,
                        include_internal,
                        include_context=include_context,
                        include_internal_convention_attributes=include_internal_convention_attributes,
                    ),
                )
                for dataset, trace_item_type, column_definitions, meta, attribute_type in tasks
            ]
            for dataset, future in futures:
                result_attributes, _ = future.result()
                attributes_by_dataset[dataset].extend(result_attributes)

        if include_custom_context:
            project_ids = [project.id for project in snuba_params.projects]
            for dataset, attributes in attributes_by_dataset.items():
                attach_custom_attribute_context(
                    attributes, organization, SupportedTraceItemType(dataset), project_ids
                )

        merged = sort_merged_attributes(
            merge_attributes_across_datasets(attributes_by_dataset), sort
        )
        if not expand_context:
            for attribute in merged:
                attribute.pop("context", None)

        response = self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(
                data_fn=lambda offset, limit: merged[offset : offset + limit]
            ),
            default_per_page=100,
            max_per_page=max_attributes,
        )
        response["X-Hits"] = len(merged)
        return response
