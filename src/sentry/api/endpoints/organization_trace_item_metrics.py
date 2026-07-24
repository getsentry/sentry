from typing import Never, NotRequired, TypedDict

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
)
from sentry.api.paginator import ChainPaginator, GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.explore.models import (
    TraceItemAttributeValueContext,
    TraceItemTypes,
    TraceMetricTypes,
)
from sentry.models.organization import Organization
from sentry.search.eap.constants import (
    METRIC_NAME_ALIAS,
    METRIC_TYPE_ALIAS,
    METRIC_UNIT_ALIAS,
)
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer, is_valid_referrer
from sentry.snuba.trace_metrics import TraceMetrics

_COUNT_ALIAS = f"count({METRIC_NAME_ALIAS})"
_LAST_SEEN_ALIAS = "max(timestamp_precise)"

# Sortable response fields mapped to their underlying query aliases. Keeps the
# public `sort` param decoupled from the internal aggregate expressions.
_SORT_FIELDS = {
    "name": METRIC_NAME_ALIAS,
    "type": METRIC_TYPE_ALIAS,
    "unit": METRIC_UNIT_ALIAS,
    "count": _COUNT_ALIAS,
    "lastSeen": _LAST_SEEN_ALIAS,
}

# The full grouping key — appended after any sort so pagination always has a
# stable total order (a single field like count isn't unique across rows).
_GROUPING_ORDER = [METRIC_NAME_ALIAS, METRIC_TYPE_ALIAS, METRIC_UNIT_ALIAS]

# Metrics count is small; a generous cap avoids paginating in practice.
MAX_METRICS_PER_PAGE = 1000


class TraceMetricContext(TypedDict):
    brief: NotRequired[str]
    # Longer-form notes, normalized to a list to match the attributes context
    # shape (see TraceItemAttributeContext.details).
    details: NotRequired[list[str]]


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
    # A response field to sort by, optionally prefixed with `-` for descending
    # (e.g. `-count`). Defaults to metric name.
    sort = serializers.CharField(required=False)
    # Overrides the referrer attached to the underlying query so callers (e.g.
    # Seer tools) remain distinguishable in query analytics. Falls back to the
    # endpoint default when absent or not a recognized referrer.
    referrer = serializers.CharField(required=False)
    # Restrict results to metrics that have authored context. Gated behind the
    # data-browsing-attribute-context feature (a no-op without it).
    contextOnly = serializers.BooleanField(required=False, default=False, source="context_only")

    def validate_sort(self, value: str) -> str:
        field = value[1:] if value.startswith("-") else value
        if field not in _SORT_FIELDS:
            raise serializers.ValidationError(
                f"Invalid sort field `{field}`. Must be one of: {', '.join(_SORT_FIELDS)}."
            )
        return value


@cell_silo_endpoint
class OrganizationTraceItemMetricsEndpoint(OrganizationTraceItemAttributesEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
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
            return self.paginate(request=request, paginator=ChainPaginator([]))

        adjusted_start, adjusted_end = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        snuba_params.start = adjusted_start
        snuba_params.end = adjusted_end

        # Allowlist the caller-supplied referrer; fall back to the endpoint
        # default when absent or unrecognized so query analytics stay clean.
        referrer = serialized.get("referrer")
        if not referrer or not is_valid_referrer(referrer):
            referrer = Referrer.API_EXPLORE_TRACEMETRICS_METRICS_LIST.value

        query_string = serialized.get("query", "")
        # Authored context lives in TraceItemAttributeValueContext and is gated
        # behind the feature; conventions don't apply to custom metrics.
        has_context_feature = features.has(
            "organizations:data-browsing-attribute-context", organization, actor=request.user
        )
        # context_only restricts results to metrics that have authored context.
        context_only = serialized.get("context_only", False) and has_context_feature
        include_context = has_context_feature and (
            "context" in serialized.get("expand", set()) or context_only
        )

        if context_only:
            context_names = list(
                TraceItemAttributeValueContext.objects.filter(
                    organization=organization,
                    item_type=TraceItemTypes.TRACEMETRICS,
                    attribute_name=METRIC_NAME_ALIAS,
                )
                .values_list("attribute_value", flat=True)
                .distinct()
            )
            if not context_names:
                return self.paginate(request=request, paginator=ChainPaginator([]))
            # Restrict the metrics query to names that have context, so count,
            # sort, and pagination all operate on the filtered set.
            name_filter = build_escaped_term_filter(METRIC_NAME_ALIAS, context_names)
            query_string = f"{query_string} {name_filter}".strip()

        # Resolve the requested sort to a query orderby, always appending the
        # grouping key so pagination has a stable total order.
        sort = serialized.get("sort")
        if sort:
            descending = sort.startswith("-")
            sort_alias = _SORT_FIELDS[sort.lstrip("-")]
            sort_column = ("-" if descending else "") + sort_alias
            orderby = [sort_column] + [column for column in _GROUPING_ORDER if column != sort_alias]
        else:
            orderby = list(_GROUPING_ORDER)

        def data_fn(offset: int, limit: int) -> list[TraceMetricItem]:
            with handle_query_errors():
                results = TraceMetrics.run_table_query(
                    params=snuba_params,
                    query_string=query_string,
                    selected_columns=[
                        METRIC_NAME_ALIAS,
                        METRIC_TYPE_ALIAS,
                        METRIC_UNIT_ALIAS,
                        _COUNT_ALIAS,
                        _LAST_SEEN_ALIAS,
                    ],
                    orderby=orderby,
                    offset=offset,
                    limit=limit,
                    referrer=referrer,
                    config=SearchResolverConfig(),
                    sampling_mode=snuba_params.sampling_mode,
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
                self._attach_context(metrics, organization)
            if context_only:
                # The query filters by name only, but context is keyed by
                # (name, type) — drop rows whose specific type has no context.
                metrics = [metric for metric in metrics if "context" in metric]
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
    ) -> None:
        """Attach authored context to a page of metrics with a single lookup (no N+1)."""
        names = [metric["name"] for metric in metrics]
        if not names:
            return

        # Metric context is org-level, so look it up by name alone (no project
        # scoping) — one row per (value, type).
        context_rows = TraceItemAttributeValueContext.objects.filter(
            organization=organization,
            item_type=TraceItemTypes.TRACEMETRICS,
            attribute_name=METRIC_NAME_ALIAS,
            attribute_value__in=names,
        )
        context_by_key: dict[tuple[str, int], TraceItemAttributeValueContext] = {
            (row.attribute_value, row.attribute_type): row for row in context_rows
        }

        for metric in metrics:
            type_id = TraceMetricTypes.get_id_for_type_name(metric["type"])
            context_row = context_by_key.get((metric["name"], type_id))
            if context_row is None:
                continue
            context: TraceMetricContext = {}
            if context_row.brief is not None:
                context["brief"] = context_row.brief
            if context_row.additional_context:
                context["details"] = [context_row.additional_context]
            metric["context"] = context
