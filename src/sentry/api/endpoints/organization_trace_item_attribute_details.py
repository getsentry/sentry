from collections.abc import Iterable, Mapping, Sequence
from copy import copy
from functools import partial
from typing import Annotated, Any, NotRequired, TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_conventions.attributes import AttributeMetadata, ChangelogEntry

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    OrganizationTraceItemAttributesEndpoint,
    build_sentry_convention_context,
    get_column_definitions,
    get_sentry_convention_metadata,
    is_sentry_defined_attribute,
    resolve_attribute_unit,
)
from sentry.api.endpoints.organization_trace_item_attributes_merged import (
    MERGEABLE_DATASETS,
    MergedTraceItemAttribute,
    list_attributes_by_dataset,
    merge_attributes_across_datasets,
    sort_merged_attributes,
)
from sentry.api.endpoints.organization_trace_item_attributes_types import (
    TraceItemAttributeContext,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.response_types import as_validation_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.explore.models import TraceItemAttributeTypes
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.attribute_stats import (
    TraceItemAttributeDatasetStats,
    query_attribute_stats,
    query_column_last_seen,
    stored_keys,
)
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import (
    AttributeSourceType,
    SearchResolverConfig,
    SupportedTraceItemType,
)
from sentry.search.events.types import SnubaParams


class OrganizationTraceItemAttributeDetailsEndpointSerializer(serializers.Serializer):
    attributeName = serializers.CharField(source="attribute_name", trim_whitespace=False)
    attributeType = serializers.ChoiceField(
        choices=POSSIBLE_ATTRIBUTE_TYPES, source="attribute_type"
    )
    attributeSource = serializers.ChoiceField(
        choices=[source.value for source in AttributeSourceType],
        required=False,
        source="attribute_source",
    )
    dataset = serializers.MultipleChoiceField(choices=MERGEABLE_DATASETS, required=False)


class TraceItemAttributeChangelogEntry(TypedDict):
    version: Annotated[
        str, ApiDescription("Sentry conventions release version that included the change")
    ]
    prs: NotRequired[
        Annotated[
            list[int], ApiDescription("Sentry conventions pull request numbers for the change")
        ]
    ]
    description: NotRequired[Annotated[str, ApiDescription("Description of the change")]]


# Spread into the details literal: mypy rejects `{**match, ...}` unless a ** item declares `changelog`.
class TraceItemAttributeConventionDetails(TypedDict):
    changelog: NotRequired[
        Annotated[
            list[TraceItemAttributeChangelogEntry],
            ApiDescription(
                "Changes to the attribute's Sentry convention, newest first. Omitted when the "
                "attribute matches no convention, or the convention has no changelog or only a "
                "bare 0.0.0 entry"
            ),
        ]
    ]


class TraceItemAttributeDetails(MergedTraceItemAttribute, TraceItemAttributeConventionDetails):
    stats: Annotated[
        dict[str, TraceItemAttributeDatasetStats],
        ApiDescription("Stats for the attribute in each dataset it was found in"),
    ]
    lastSeen: Annotated[
        str | None,
        ApiDescription("When the attribute was last seen in any dataset within the time window"),
    ]
    isEditable: Annotated[
        bool,
        ApiDescription(
            "Whether custom context can be saved for the attribute: a custom string, number, "
            "or boolean attribute, stored under its own name, that Sentry doesn't define in any "
            "of its datasets. Always false without the `data-browsing-attribute-context` "
            "feature. Saving also needs write access to events in the project"
        ),
    ]


def resolve_convention(
    attribute: MergedTraceItemAttribute,
    keys_by_dataset: Mapping[str, str],
    snuba_params: SnubaParams,
) -> tuple[AttributeMetadata | None, TraceItemAttributeContext | None]:
    name, attribute_type = attribute["name"], attribute["attributeType"]
    for dataset in attribute["datasets"]:
        keys = stored_keys(dataset, keys_by_dataset[dataset], attribute_type, snuba_params)
        if not keys:
            continue
        stored_name = keys[0].name
        metadata = get_sentry_convention_metadata(name, stored_name, attribute_type)
        if metadata is None:
            continue
        context = build_sentry_convention_context(name, stored_name, attribute_type)
        unit = resolve_attribute_unit(
            stored_name, name, attribute_type, SupportedTraceItemType(dataset)
        )
        if context is not None and unit is not None:
            context["unit"] = unit
        return metadata, context
    return get_sentry_convention_metadata(name, name, attribute_type), None


def build_convention_details(
    metadata: AttributeMetadata | None,
) -> TraceItemAttributeConventionDetails:
    if metadata is None or not metadata.changelog or _is_initial_changelog(metadata.changelog):
        return {}

    changelog: list[TraceItemAttributeChangelogEntry] = []
    for entry in metadata.changelog:
        serialized: TraceItemAttributeChangelogEntry = {"version": entry.version}
        if entry.prs is not None:
            serialized["prs"] = list(entry.prs)
        if entry.description is not None:
            serialized["description"] = entry.description
        changelog.append(serialized)
    return {"changelog": changelog}


# A lone `0.0.0` entry only marks the convention's initial definition, so it says nothing.
def _is_initial_changelog(changelog: Sequence[ChangelogEntry]) -> bool:
    return (
        len(changelog) == 1
        and changelog[0].version == "0.0.0"
        and not changelog[0].prs
        and not changelog[0].description
    )


def is_editable(attribute: MergedTraceItemAttribute, snuba_params: SnubaParams) -> bool:
    if attribute["attributeSource"]["source_type"] != AttributeSourceType.USER.value:
        return False
    if attribute["attributeType"] not in TraceItemAttributeTypes.TYPE_NAMES:
        return False
    for dataset in attribute["datasets"]:
        definitions = get_column_definitions(SupportedTraceItemType(dataset))
        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=definitions
        )
        try:
            resolved_attribute, _ = resolver.resolve_attribute(attribute["name"])
        except InvalidSearchQuery:
            return False
        if resolved_attribute.internal_name != attribute["name"] or is_sentry_defined_attribute(
            resolved_attribute, definitions
        ):
            return False
    return True


def _matching_attributes(
    attributes: Iterable[MergedTraceItemAttribute], name: str, source: str | None
) -> list[MergedTraceItemAttribute]:
    return [
        attribute
        for attribute in attributes
        if attribute["name"] == name
        and (source is None or attribute["attributeSource"]["source_type"] == source)
    ]


def _is_listable_sentry_column(name: str, attribute_type: str, datasets: Iterable[str]) -> bool:
    proto_type = constants.ATTRIBUTES_QUERY_PARAM_TO_ATTRIBUTE_TYPE_MAP.get(attribute_type)
    for dataset in datasets:
        column = get_column_definitions(SupportedTraceItemType(dataset)).columns.get(name)
        if (
            column is not None
            and column.proto_type == proto_type
            and not column.secondary_alias
            and not column.private
        ):
            return True
    return False


@cell_silo_endpoint
class OrganizationTraceItemAttributeDetailsEndpoint(OrganizationTraceItemAttributesEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:attribute-management", organization, actor=request.user
        ) or not self.has_feature(organization, request):
            return Response(status=404)

        serializer = OrganizationTraceItemAttributeDetailsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"detail": "No projects available."}, status=404)

        serialized: dict[str, Any] = serializer.validated_data
        attribute_name = serialized["attribute_name"]
        attribute_source = serialized.get("attribute_source")
        list_attributes = partial(
            list_attributes_by_dataset,
            self,
            request,
            organization,
            datasets=serialized.get("dataset"),
            attribute_types=[serialized["attribute_type"]],
            include_context=True,
        )
        attributes_by_dataset = list_attributes(snuba_params, substring_match="")
        merged = merge_attributes_across_datasets(attributes_by_dataset)
        matches = _matching_attributes(merged, attribute_name, attribute_source) or [
            attribute
            # Span details drop `sentry.` from stored span attributes without a public alias.
            for attribute in _matching_attributes(
                merged, f"sentry.{attribute_name}", attribute_source
            )
            if SupportedTraceItemType.SPANS.value in attribute["datasets"]
        ]
        is_unlisted_column = not matches and _is_listable_sentry_column(
            attribute_name, serialized["attribute_type"], attributes_by_dataset
        )
        if is_unlisted_column:
            # Columns such as `trace` are only listed when searched for by name. Listing
            # widens the window in place, and the stats below need it widened only once.
            attributes_by_dataset = list_attributes(
                copy(snuba_params), substring_match=attribute_name
            )
            matches = _matching_attributes(
                merge_attributes_across_datasets(attributes_by_dataset),
                attribute_name,
                attribute_source,
            )
        if not matches:
            return Response({"detail": "Attribute not found."}, status=404)

        match = sort_merged_attributes(matches, "name")[0]
        keys_by_dataset = {
            dataset: next(
                attribute["key"]
                for attribute in attributes_by_dataset[dataset]
                if attribute["name"] == match["name"]
                and attribute["attributeType"] == match["attributeType"]
                and attribute["attributeSource"]["source_type"]
                == match["attributeSource"]["source_type"]
            )
            for dataset in match["datasets"]
        }
        known_last_seen = None
        if is_unlisted_column:
            known_last_seen = query_column_last_seen(
                match["attributeType"], keys_by_dataset, snuba_params
            )
            if not known_last_seen:
                return Response({"detail": "Attribute not found."}, status=404)
            match = {
                **match,
                "datasets": [
                    dataset for dataset in match["datasets"] if dataset in known_last_seen
                ],
            }
            keys_by_dataset = {dataset: keys_by_dataset[dataset] for dataset in match["datasets"]}
        stats, last_seen = query_attribute_stats(
            match["attributeType"],
            keys_by_dataset,
            snuba_params,
            known_last_seen=known_last_seen,
            # Columns found this way are mostly IDs and timestamps, where a distinct count is costly.
            include_cardinality=not is_unlisted_column,
        )
        metadata, context = resolve_convention(match, keys_by_dataset, snuba_params)
        if context is not None:
            match = {**match, "context": context}
        details: TraceItemAttributeDetails = {
            **match,
            "stats": stats,
            "lastSeen": last_seen.isoformat() if last_seen is not None else None,
            "isEditable": features.has(
                "organizations:data-browsing-attribute-context", organization, actor=request.user
            )
            and is_editable(match, snuba_params),
            **build_convention_details(metadata),
        }
        return Response(details)
