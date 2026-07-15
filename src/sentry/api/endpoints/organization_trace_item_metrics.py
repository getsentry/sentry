from typing import Never, NotRequired, TypedDict

from django.db.models import Q
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
)
from sentry.api.paginator import GenericOffsetPaginator
from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.trace_metrics import TraceMetrics

# Public aliases (see search/eap/trace_metrics/attributes.py).
METRIC_NAME_ALIAS = "metric.name"
METRIC_TYPE_ALIAS = "metric.type"
METRIC_UNIT_ALIAS = "metric.unit"
_COUNT_ALIAS = f"count({METRIC_NAME_ALIAS})"
_LAST_SEEN_ALIAS = "max(timestamp_precise)"

_SELECTED_COLUMNS = [
    METRIC_NAME_ALIAS,
    METRIC_TYPE_ALIAS,
    METRIC_UNIT_ALIAS,
    _COUNT_ALIAS,
    _LAST_SEEN_ALIAS,
]

# Metrics count is small; a generous cap avoids paginating in practice.
MAX_METRICS_PER_PAGE = 1000


class TraceMetricContext(TypedDict):
    brief: NotRequired[str]
    additionalContext: NotRequired[str]


class TraceMetricItem(TypedDict):
    name: str
    type: str
    unit: str | None
    count: int
    lastSeen: float | None
    # Only present when `expand=context` is requested and the
    # data-browsing-attribute-context feature is enabled.
    context: NotRequired[TraceMetricContext]


class OrganizationTraceItemMetricsSerializer(serializers.Serializer[Never]):
    query = serializers.CharField(required=False)
    expand = serializers.MultipleChoiceField(choices=["context"], required=False)


@cell_silo_endpoint
class OrganizationTraceItemMetricsEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:
        """List trace metrics (name, type, unit, count, last seen) with optional context."""
        if not self.has_feature(organization, request):
            return Response(status=404)

        serializer = OrganizationTraceItemMetricsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        query_string = serialized.get("query", "")
        # Authored context is joined from TraceItemAttributeValueContext, gated
        # behind the feature; conventions don't apply to custom metrics.
        include_context = "context" in serialized.get("expand", set()) and features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        )
        project_ids = [project.id for project in snuba_params.projects]

        def data_fn(offset: int, limit: int) -> list[TraceMetricItem]:
            results = TraceMetrics.run_table_query(
                params=snuba_params,
                query_string=query_string,
                selected_columns=_SELECTED_COLUMNS,
                orderby=[METRIC_NAME_ALIAS],
                offset=offset,
                limit=limit,
                referrer=Referrer.API_EXPLORE_TRACEMETRICS_METRICS_LIST.value,
                config=SearchResolverConfig(),
            )
            metrics: list[TraceMetricItem] = [
                {
                    "name": row[METRIC_NAME_ALIAS],
                    "type": row[METRIC_TYPE_ALIAS],
                    "unit": row.get(METRIC_UNIT_ALIAS),
                    "count": row[_COUNT_ALIAS],
                    "lastSeen": row.get(_LAST_SEEN_ALIAS),
                }
                for row in results["data"]
            ]
            if include_context:
                self._attach_context(metrics, organization, project_ids)
            return metrics

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: results,
            default_per_page=MAX_METRICS_PER_PAGE,
            max_per_page=MAX_METRICS_PER_PAGE,
        )

    def _attach_context(
        self,
        metrics: list[TraceMetricItem],
        organization: Organization,
        project_ids: list[int],
    ) -> None:
        """Attach authored context to a page of metrics with a single lookup (no N+1)."""
        names = [metric["name"] for metric in metrics]
        if not names:
            return

        # Project-scoped rows for the requested projects plus org-wide rows
        # (null project), in one query.
        context_rows = TraceItemAttributeValueContext.objects.filter(
            Q(project__isnull=True) | Q(project_id__in=project_ids),
            organization=organization,
            item_type=TraceItemTypes.TRACEMETRICS,
            attribute_name=METRIC_NAME_ALIAS,
            attribute_value__in=names,
        )

        # Key by (value, type); prefer a project-scoped row over an org-wide one.
        context_by_key: dict[tuple[str, int], TraceItemAttributeValueContext] = {}
        for row in context_rows:
            key = (row.attribute_value, row.attribute_type)
            if key not in context_by_key or row.project_id is not None:
                context_by_key[key] = row

        for metric in metrics:
            type_id = TraceMetricTypes.get_id_for_type_name(metric["type"])
            context_row = context_by_key.get((metric["name"], type_id))
            if context_row is None:
                continue
            context: TraceMetricContext = {}
            if context_row.brief is not None:
                context["brief"] = context_row.brief
            if context_row.additional_context is not None:
                context["additionalContext"] = context_row.additional_context
            metric["context"] = context
