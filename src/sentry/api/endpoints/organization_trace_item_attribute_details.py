from typing import Annotated, Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attribute_stats import (
    TraceItemAttributeDatasetStats,
    query_attribute_stats,
)
from sentry.api.endpoints.organization_trace_item_attributes import (
    POSSIBLE_ATTRIBUTE_TYPES,
    OrganizationTraceItemAttributesEndpoint,
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
from sentry.search.eap.types import AttributeSourceType


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


class TraceItemAttributeDetails(MergedTraceItemAttribute):
    stats: Annotated[
        dict[str, TraceItemAttributeDatasetStats],
        ApiDescription("Stats for the attribute in each dataset it was found in"),
    ]
    lastSeen: Annotated[
        str | None,
        ApiDescription("When the attribute was last seen in any dataset within the time window"),
    ]


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
        attributes_by_dataset, stored_refs_by_dataset = list_attributes_by_dataset(
            self,
            request,
            organization,
            snuba_params,
            datasets=serialized.get("dataset"),
            attribute_types=[serialized["attribute_type"]],
            substring_match="",
            include_context=True,
        )
        matches = [
            attribute
            for attribute in merge_attributes_across_datasets(attributes_by_dataset)
            if attribute["name"] == attribute_name
            and (
                attribute_source is None
                or attribute["attributeSource"]["source_type"] == attribute_source
            )
        ]
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
        stats, last_seen = query_attribute_stats(
            match["attributeType"], refs_by_dataset, snuba_params
        )
        details: TraceItemAttributeDetails = {
            **match,
            "stats": stats,
            "lastSeen": last_seen.isoformat() if last_seen is not None else None,
        }
        return Response(details)
