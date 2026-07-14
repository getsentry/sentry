from typing import Never

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType as ProtoTraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeValue,
    Function,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

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
# metric context is stored as context for that attribute value. A metric name
# can carry more than one type (e.g. both a counter and a gauge named "foo").
METRIC_NAME_ALIAS = "metric.name"
METRIC_TYPE_ALIAS = "metric.type"

_TYPE_COLUMN_LABEL = "metric.type"


class OrganizationTraceItemMetricContextPutSerializer(serializers.Serializer[Never]):
    # Optional: when omitted we infer the type from storage, and only require it
    # when the metric name is ambiguous (stored under more than one type).
    metricType = serializers.ChoiceField(ALLOWED_METRIC_TYPES, source="metric_type", required=False)
    brief = serializers.CharField(max_length=280)
    additionalContext = serializers.CharField(
        source="additional_context", required=False, allow_null=True, allow_blank=True
    )


def get_metric_types_in_storage(resolver: SearchResolver, metric_name: str) -> list[str]:
    """
    The distinct metric types stored under ``metric_name`` for the resolver's
    params. An empty list means the metric name was never seen.
    """
    name_attribute, _ = resolver.resolve_attribute(METRIC_NAME_ALIAS)
    type_attribute, _ = resolver.resolve_attribute(METRIC_TYPE_ALIAS)
    type_key = type_attribute.proto_definition

    meta = resolver.resolve_meta(
        referrer=resolve_attribute_values_referrer(SupportedTraceItemType.TRACEMETRICS.value).value
    )
    meta.trace_item_type = ProtoTraceItemType.TRACE_ITEM_TYPE_METRIC

    # Exact-match on the name (no substring), grouped by type — this both proves
    # the metric exists and enumerates its types in a single query.
    rpc_request = TraceItemTableRequest(
        meta=meta,
        filter=TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=name_attribute.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=metric_name),
            )
        ),
        columns=[
            Column(label=_TYPE_COLUMN_LABEL, key=type_key),
            Column(
                label="count",
                aggregation=AttributeAggregation(
                    aggregate=Function.FUNCTION_COUNT, key=type_key, label="count"
                ),
            ),
        ],
        group_by=[type_key],
        limit=len(ALLOWED_METRIC_TYPES) + 1,
    )
    with handle_query_errors():
        responses = snuba_rpc.table_rpc([rpc_request])

    column_values = responses[0].column_values
    type_column = next(
        (cv for cv in column_values if cv.attribute_name == _TYPE_COLUMN_LABEL), None
    )
    if type_column is None:
        return []
    return [value.val_str for value in type_column.results if value.val_str]


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

        # Confirm the metric exists and resolve which type this context is for.
        stored_types = get_metric_types_in_storage(resolver, metric)
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
