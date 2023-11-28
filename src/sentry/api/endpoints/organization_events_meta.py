import re
from typing import Mapping, Optional, Tuple

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, search
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import (
    NoProjects,
    OrganizationEventsEndpointBase,
    OrganizationEventsV2EndpointBase,
)
from sentry.api.event_search import parse_search_query
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.models.organization import Organization
from sentry.search.events.fields import get_function_alias
from sentry.snuba import spans_indexed, spans_metrics
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, parse_mri
from sentry.snuba.referrer import Referrer


@region_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get_features(self, organization: Organization, request: Request) -> Mapping[str, bool]:
        feature_names = [
            "organizations:use-metrics-layer",
            "organizations:on-demand-metrics-extraction",
            "organizations:on-demand-metrics-extraction-widgets",
        ]

        batch_features = features.batch_has(
            feature_names,
            organization=organization,
            actor=request.user,
        )

        all_features = (
            batch_features.get(f"organization:{organization.id}", {})
            if batch_features is not None
            else {}
        )

        for feature_name in feature_names:
            if feature_name not in all_features:
                all_features[feature_name] = features.has(
                    feature_name, organization=organization, actor=request.user
                )

        return all_features

    def build_count_aggregate(
        self, parsed_custom_metric: Optional[ParsedMRI] = None
    ) -> Tuple[str, str]:
        aggregate = "count()"

        if parsed_custom_metric is not None:
            mri = parsed_custom_metric.mri_string
            if parsed_custom_metric.is_counter():
                # Counters have to be counted with `sum` since we are interested about the value in each bucket.
                aggregate = f"sum({mri})"
            elif parsed_custom_metric.is_set():
                # Sets have to be counted with `count_unique` since this is the operator exposed by the API.
                aggregate = f"count_unique({mri})"
            else:
                aggregate = f"count({mri})"

        return aggregate, get_function_alias(aggregate)

    def build_count_query(self, query: Optional[str]) -> Optional[str]:
        return query

    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        batch_features = self.get_features(organization, request)

        query = request.GET.get("query")

        custom_metric = request.GET.get("customMetric")
        if custom_metric:
            parsed_custom_metric = parse_mri(custom_metric)
            if parsed_custom_metric is None:
                return Response({"detail": "The custom metric is not a valid MRI."}, status=400)

            count_aggregate, aggregate_alias = self.build_count_aggregate(parsed_custom_metric)
        else:
            count_aggregate, aggregate_alias = self.build_count_aggregate()

        try:
            use_on_demand_metrics, on_demand_metrics_type = self.handle_on_demand(request)
        except ValueError:
            metric_type_values = [e.value for e in MetricSpecType]
            metric_types = ",".join(metric_type_values)
            return Response(
                {"detail": f"On demand metric type must be one of: {metric_types}"}, status=400
            )

        on_demand_metrics_enabled = (
            batch_features.get("organizations:on-demand-metrics-extraction", False)
            or batch_features.get("organizations:on-demand-metrics-extraction-widgets", False)
        ) and use_on_demand_metrics

        force_metrics_layer = request.GET.get("forceMetricsLayer") == "true"

        dataset = self.get_dataset(request)
        with self.handle_query_errors():
            result = dataset.query(
                selected_columns=[count_aggregate],
                params=params,
                query=self.build_count_query(query),
                referrer="api.organization-events-meta",
                use_metrics_layer=force_metrics_layer
                or batch_features.get("organizations:use-metrics-layer", False),
                on_demand_metrics_enabled=on_demand_metrics_enabled,
                on_demand_metrics_type=on_demand_metrics_type,
            )

        return Response({"count": result["data"][0][aggregate_alias]})


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


@region_silo_endpoint
class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        try:
            # events-meta is still used by events v1 which doesn't require global views
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="find_lookup_keys") as span:
            possible_keys = ["transaction"]
            lookup_keys = {key: request.query_params.get(key) for key in possible_keys}

            if not any(lookup_keys.values()):
                return Response(
                    {
                        "detail": f"Must provide one of {possible_keys} in order to find related events"
                    },
                    status=400,
                )

        with self.handle_query_errors():
            with sentry_sdk.start_span(op="discover.endpoint", description="filter_creation"):
                projects = self.get_projects(request, organization)
                query_kwargs = build_query_params_from_request(
                    request, organization, projects, params.get("environment")
                )
                query_kwargs["limit"] = 5
                try:
                    # Need to escape quotes in case some "joker" has a transaction with quotes
                    transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', lookup_keys["transaction"])
                    parsed_terms = parse_search_query(f'transaction:"{transaction_name}"')
                except ParseError:
                    return Response({"detail": "Invalid transaction search"}, status=400)

                if query_kwargs.get("search_filters"):
                    query_kwargs["search_filters"].extend(parsed_terms)
                else:
                    query_kwargs["search_filters"] = parsed_terms

                query_kwargs["actor"] = request.user

            with sentry_sdk.start_span(op="discover.endpoint", description="issue_search"):
                results = search.query(**query_kwargs)

        with sentry_sdk.start_span(op="discover.endpoint", description="serialize_results") as span:
            results = list(results)
            span.set_data("result_length", len(results))
            context = serialize(
                results,
                request.user,
                GroupSerializer(
                    environment_func=self._get_environment_func(request, organization.id)
                ),
            )

        return Response(context)


@region_silo_endpoint
class OrganizationSpansSamplesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        buckets = request.GET.get("intervals", 3)
        lower_bound = request.GET.get("lowerBound", 0)
        first_bound = request.GET.get("firstBound")
        second_bound = request.GET.get("secondBound")
        upper_bound = request.GET.get("upperBound")
        column = request.GET.get("column", "span.self_time")
        selected_columns = request.GET.getlist("additionalFields", []) + [
            "project",
            "transaction.id",
            column,
            "timestamp",
            "span_id",
            "profile_id",
        ]

        if lower_bound is None or upper_bound is None:
            bound_results = spans_metrics.query(
                selected_columns=[
                    f"p50({column}) as first_bound",
                    f"p95({column}) as second_bound",
                ],
                params=params,
                query=request.query_params.get("query"),
                referrer=Referrer.API_SPAN_SAMPLE_GET_BOUNDS.value,
            )
            if len(bound_results["data"]) != 1:
                raise ParseError("Could not find bounds")

            bound_data = bound_results["data"][0]
            first_bound, second_bound = bound_data["first_bound"], bound_data["second_bound"]
            if lower_bound == 0 or upper_bound == 0:
                raise ParseError("Could not find bounds")

        result = spans_indexed.query(
            selected_columns=[
                f"bounded_sample({column}, {lower_bound}, {first_bound}) as lower",
                f"bounded_sample({column}, {first_bound}, {second_bound}) as middle",
                f"bounded_sample({column}, {second_bound}{', ' if upper_bound else ''}{upper_bound}) as top",
                f"rounded_time({buckets})",
                "profile_id",
            ],
            orderby=["-profile_id"],
            params=params,
            query=request.query_params.get("query"),
            referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_IDS.value,
        )
        span_ids = []
        for row in result["data"]:
            lower, middle, top = row["lower"], row["middle"], row["top"]
            if lower:
                span_ids.append(lower)
            if middle:
                span_ids.append(middle)
            if top:
                span_ids.append(top)

        if len(span_ids) > 0:
            query = f"span_id:[{','.join(span_ids)}] {request.query_params.get('query')}"
        else:
            query = request.query_params.get("query")

        result = spans_indexed.query(
            selected_columns=selected_columns,
            orderby=["timestamp"],
            params=params,
            query=query,
            limit=9,
            referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
        )
        return Response({"data": result["data"]})
