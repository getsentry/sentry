from typing import Never

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.endpoints.organization_trace_item_attributes import (
    OrganizationTraceItemAttributesEndpointBase,
    adjust_start_end_window,
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
from sentry.search.eap.trace_metrics.config import ALLOWED_METRIC_TYPES
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.events.types import SnubaParams
from sentry.snuba.trace_metrics import TraceMetrics

# Metrics are trace items keyed by the value of the `metric.name` attribute, so
# metric context is stored as context for that attribute value. A metric name
# can carry more than one type (e.g. both a counter and a gauge named "foo").
METRIC_NAME_ALIAS = "metric.name"
METRIC_TYPE_ALIAS = "metric.type"


class OrganizationTraceItemMetricContextPutSerializer(serializers.Serializer[Never]):
    # Optional: when omitted we infer the type from storage, and only require it
    # when the metric name is ambiguous (stored under more than one type).
    metricType = serializers.ChoiceField(ALLOWED_METRIC_TYPES, source="metric_type", required=False)
    brief = serializers.CharField(max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )


def get_metric_types_in_storage(snuba_params: SnubaParams, metric_name: str) -> list[str]:
    """
    The distinct known metric types stored under ``metric_name`` for the given
    params. An empty list means the metric name was never seen. Stored types
    outside the known set are ignored so an unexpected value can't later resolve
    to a null ``attribute_type``.
    """
    # Exact-match the name and group by type via count(); the distinct
    # `metric.type` rows both prove the metric exists and enumerate its types.
    escaped_name = metric_name.replace("\\", "\\\\").replace('"', '\\"')
    with handle_query_errors():
        results = TraceMetrics.run_table_query(
            params=snuba_params,
            query_string=f'{METRIC_NAME_ALIAS}:"{escaped_name}"',
            selected_columns=[METRIC_TYPE_ALIAS, "count(value)"],
            orderby=None,
            offset=0,
            limit=len(ALLOWED_METRIC_TYPES) + 1,
            referrer=resolve_attribute_values_referrer(
                SupportedTraceItemType.TRACEMETRICS.value
            ).value,
            config=SearchResolverConfig(),
        )

    return [
        row[METRIC_TYPE_ALIAS]
        for row in results["data"]
        if row.get(METRIC_TYPE_ALIAS) in ALLOWED_METRIC_TYPES
    ]


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

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"detail": "No projects available."}, status=400)

        adjusted_start, adjusted_end = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start
        snuba_params.end = adjusted_end

        # Confirm the metric exists and resolve which type this context is for.
        stored_types = get_metric_types_in_storage(snuba_params, metric)
        if not stored_types:
            return Response({"detail": f"Metric `{metric}` was not found."}, status=400)

        requested_type = data.get("metric_type")
        if requested_type is not None:
            if requested_type not in stored_types:
                return Response(
                    {"detail": f"Metric `{metric}` was not found for type `{requested_type}`."},
                    status=400,
                )
            metric_type = requested_type
        elif len(stored_types) == 1:
            metric_type = stored_types[0]
        else:
            return Response(
                {
                    "detail": f"Metric `{metric}` has multiple types "
                    f"({', '.join(sorted(stored_types))}); pass `metricType` to specify which."
                },
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
        # Metric context is always org-level for now (project-scoped context is
        # not supported yet), so it is never scoped to a specific project.
        context, created = TraceItemAttributeValueContext.objects.update_or_create(
            organization=organization,
            project=None,
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
