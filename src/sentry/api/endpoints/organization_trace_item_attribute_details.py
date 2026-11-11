from collections.abc import Iterable, Mapping, Sequence
from copy import copy
from functools import partial
from typing import Annotated, Any, NotRequired, TypedDict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_conventions.attributes import ChangelogEntry

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attribute_stats import (
    TraceItemAttributeDatasetStats,
    query_attribute_stats,
    query_column_last_seen,
)
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    OrganizationTraceItemAttributesEndpoint,
    StoredRef,
    get_column_definitions,
    get_sentry_convention_metadata,
)
from sentry.api.endpoints.organization_trace_item_attributes_merged import (
    MERGEABLE_DATASETS,
    MergedTraceItemAttribute,
    list_attributes_by_dataset,
    merge_attributes_across_datasets,
    sort_merged_attributes,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.response_types import as_validation_errors
from sentry.models.organization import Organization
from sentry.search.eap import constants
from sentry.search.eap.types import AttributeSourceType, SupportedTraceItemType


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
                "Changes to the attribute's Sentry convention, newest first. Present only for "
                "attributes that match a Sentry convention changed since its initial definition"
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


def build_convention_details(
    attribute: MergedTraceItemAttribute,
    refs_by_dataset: Mapping[str, Sequence[StoredRef]],
) -> TraceItemAttributeConventionDetails:
    # The merged context comes from the first dataset's last stored name, so the changelog
    # walks names in that order too.
    internal_names = list(
        dict.fromkeys(ref.name for refs in refs_by_dataset.values() for ref in reversed(refs))
    ) or [attribute["name"]]
    candidates = (
        get_sentry_convention_metadata(attribute["name"], internal_name, attribute["attributeType"])
        for internal_name in internal_names
    )
    metadata = next((candidate for candidate in candidates if candidate is not None), None)
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
        attributes_by_dataset, stored_refs_by_dataset = list_attributes(
            snuba_params, substring_match=""
        )
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
            attributes_by_dataset, stored_refs_by_dataset = list_attributes(
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
        refs_by_dataset = {
            dataset: list(
                dict.fromkeys(
                    ref
                    for attribute in attributes_by_dataset[dataset]
                    if attribute["name"] == match["name"]
                    and attribute["attributeType"] == match["attributeType"]
                    and attribute["attributeSource"]["source_type"]
                    == match["attributeSource"]["source_type"]
                    for ref in stored_refs_by_dataset[dataset].get(
                        (attribute["attributeType"], attribute["key"]), []
                    )
                )
            )
            for dataset in match["datasets"]
        }
        known_last_seen = None
        if is_unlisted_column:
            known_last_seen = query_column_last_seen(refs_by_dataset, snuba_params)
            if not known_last_seen:
                return Response({"detail": "Attribute not found."}, status=404)
            match = {
                **match,
                "datasets": [
                    dataset for dataset in match["datasets"] if dataset in known_last_seen
                ],
            }
            refs_by_dataset = {dataset: refs_by_dataset[dataset] for dataset in match["datasets"]}
        stats, last_seen = query_attribute_stats(
            match["attributeType"],
            refs_by_dataset,
            snuba_params,
            known_last_seen=known_last_seen,
            # Columns found this way are mostly IDs and timestamps, where a distinct count is costly.
            include_cardinality=not is_unlisted_column,
        )
        details: TraceItemAttributeDetails = {
            **match,
            "stats": stats,
            "lastSeen": last_seen.isoformat() if last_seen is not None else None,
            **build_convention_details(match, refs_by_dataset),
        }
        return Response(details)
