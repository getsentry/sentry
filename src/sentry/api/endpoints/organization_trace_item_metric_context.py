from typing import Never

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeValuesRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointBase,
    adjust_start_end_window,
    get_column_definitions,
    resolve_attribute_values_referrer,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.trace_item_attribute_value_context import (
    TraceItemAttributeValueContextSerializer,
)
from sentry.api.utils import handle_query_errors
from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import ALLOWED_METRIC_TYPES
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.utils import snuba_rpc

# Metrics are trace items keyed by the value of the `metric.name` attribute, so
# metric context is stored as context for that attribute value.
METRIC_NAME_ALIAS = "metric.name"


class OrganizationTraceItemMetricContextPutSerializer(serializers.Serializer[Never]):
    metricType = serializers.ChoiceField(ALLOWED_METRIC_TYPES, source="metric_type")
    brief = serializers.CharField(max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )


def metric_name_exists_in_storage(resolver: SearchResolver, metric_name: str) -> bool:
    """Whether a trace metric with the given name exists in storage for the resolver's params."""
    resolved_attribute, _ = resolver.resolve_attribute(METRIC_NAME_ALIAS)
    meta = resolver.resolve_meta(
        referrer=resolve_attribute_values_referrer(SupportedTraceItemType.TRACEMETRICS.value).value
    )
    meta.trace_item_type = ProtoTraceItemType.TRACE_ITEM_TYPE_METRIC

    # The values RPC only substring-matches, so pass the name to narrow the page
    # then check for an exact hit — a shared prefix can't cause a false positive.
    rpc_request = TraceItemAttributeValuesRequest(
        meta=meta,
        key=resolved_attribute.proto_definition,
        value_substring_match=metric_name,
        limit=10000,
    )
    with handle_query_errors():
        rpc_response = snuba_rpc.attribute_values_rpc(rpc_request)

    return metric_name in rpc_response.values


@cell_silo_endpoint
class OrganizationTraceItemMetricContextEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def put(self, request: Request, organization: Organization, metric: str) -> Response:
        """Create or update the authored context for a trace metric."""
        if not self.has_feature(organization, request):
            return Response(status=404)

        # Custom context is gated; sentry conventions context is served separately.
        if not features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        ):
            return Response(status=404)

        serializer = OrganizationTraceItemMetricContextPutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        metric_type = data["metric_type"]

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

        resolver = SearchResolver(
            params=snuba_params,
            config=SearchResolverConfig(),
            definitions=get_column_definitions(SupportedTraceItemType.TRACEMETRICS),
        )

        # Confirm the metric has actually been seen in storage before authoring context.
        if not metric_name_exists_in_storage(resolver, metric):
            return Response(
                {"detail": f"Metric `{metric}` was not found."},
                status=400,
            )

        # Only persist optional fields that were provided, so a partial update
        # doesn't clear previously stored context.
        optional_fields = {field: data[field] for field in ("additional_context",) if field in data}
        defaults = {
            "brief": data["brief"],
            "updated_by_id": request.user.id,
            **optional_fields,
        }
        # Race-safe: the lookup kwargs match the unique constraints, so a losing
        # concurrent INSERT is caught by update_or_create rather than 500ing.
        context, created = TraceItemAttributeValueContext.objects.update_or_create(
            organization=organization,
            project=scope_project,
            item_type=TraceItemTypes.get_id_for_type_name(
                SupportedTraceItemType.TRACEMETRICS.value
            ),
            attribute_name=METRIC_NAME_ALIAS,
            attribute_value=metric,
            attribute_type=TraceMetricTypes.get_id_for_type_name(metric_type),
            defaults=defaults,
            create_defaults={
                "additional_context": None,
                **defaults,
                "created_by_id": request.user.id,
            },
        )

        return Response(
            serialize(context, request.user, TraceItemAttributeValueContextSerializer()),
            status=201 if created else 200,
        )
