import re

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options, search
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import parse_search_query
from sentry.api.helpers.environments import get_environment_func
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.api.utils import handle_query_errors
from sentry.middleware import is_frontend_request
from sentry.models.organization import Organization
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.snuba import spans_indexed, spans_metrics
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.utils import RPC_DATASETS


@region_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_features(self, organization: Organization, request: Request) -> dict[str, bool | None]:
        feature_names = [
            "organizations:dashboards-mep",
            "organizations:mep-rollout-flag",
            "organizations:performance-use-metrics",
            "organizations:profiling",
            "organizations:dynamic-sampling",
            "organizations:use-metrics-layer",
            "organizations:starfish-view",
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

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        dataset = self.get_dataset(request)

        batch_features = self.get_features(organization, request)

        use_metrics = (
            (
                batch_features.get("organizations:mep-rollout-flag", False)
                and batch_features.get("organizations:dynamic-sampling", False)
            )
            or batch_features.get("organizations:performance-use-metrics", False)
            or batch_features.get("organizations:dashboards-mep", False)
        )

        with handle_query_errors():
            if dataset in RPC_DATASETS:
                result = dataset.run_table_query(
                    params=snuba_params,
                    query_string=request.query_params.get("query"),
                    selected_columns=["count()"],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META,
                    config=SearchResolverConfig(),
                )

                return Response({"count": result["data"][0]["count()"]})
            else:
                result = dataset.query(
                    selected_columns=["count()"],
                    snuba_params=snuba_params,
                    query=request.query_params.get("query"),
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META.value,
                    has_metrics=use_metrics,
                    use_metrics_layer=batch_features.get("organizations:use-metrics-layer", False),
                    # TODO: @athena - add query_source when all datasets support it
                    # query_source=(
                    #     QuerySource.FRONTEND if is_frontend_request(request) else QuerySource.API
                    # ),
                    fallback_to_transactions=True,
                )

                return Response({"count": result["data"][0]["count"]})


UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


@region_silo_endpoint
class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", name="find_lookup_keys") as span:
            possible_keys = ["transaction"]
            lookup_keys = {key: request.query_params.get(key) for key in possible_keys}

            if not any(lookup_keys.values()):
                return Response(
                    {
                        "detail": f"Must provide one of {possible_keys} in order to find related events"
                    },
                    status=400,
                )

        with handle_query_errors():
            with sentry_sdk.start_span(op="discover.endpoint", name="filter_creation"):
                projects = self.get_projects(request, organization)
                # Filter out None values from environments
                environments = [e for e in snuba_params.environments if e is not None]
                query_kwargs = build_query_params_from_request(
                    request, organization, projects, environments
                )
                query_kwargs["limit"] = 5
                try:
                    # Need to escape quotes in case some "joker" has a transaction with quotes
                    transaction_name = UNESCAPED_QUOTE_RE.sub(
                        '\\"', lookup_keys["transaction"] or ""
                    )
                    parsed_terms = parse_search_query(f'transaction:"{transaction_name}"')
                except ParseError:
                    return Response({"detail": "Invalid transaction search"}, status=400)

                if query_kwargs.get("search_filters"):
                    query_kwargs["search_filters"].extend(parsed_terms)
                else:
                    query_kwargs["search_filters"] = parsed_terms

                query_kwargs["actor"] = request.user

            with sentry_sdk.start_span(op="discover.endpoint", name="issue_search"):
                results_cursor = search.backend.query(**query_kwargs)

        with sentry_sdk.start_span(op="discover.endpoint", name="serialize_results") as span:
            results = list(results_cursor)
            span.set_data("result_length", len(results))
            context = serialize(
                results,
                request.user,
                GroupSerializer(environment_func=get_environment_func(request, organization.id)),
            )

        return Response(context)


@region_silo_endpoint
class OrganizationSpansSamplesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        use_eap = request.GET.get("dataset", None) == "spans"
        orderby = self.get_orderby(request) or ["timestamp"]

        with handle_query_errors():
            if use_eap:
                result: EAPResponse | EventsResponse = get_eap_span_samples(
                    request, snuba_params, orderby
                )
                dataset = Spans
            else:
                result = get_span_samples(request, snuba_params, orderby)
                dataset = spans_indexed  # type: ignore[assignment]

        return Response(
            self.handle_results_with_meta(
                request,
                organization,
                snuba_params.project_ids,
                {"data": result["data"], "meta": result["meta"]},
                True,
                dataset,
            )
        )


def get_span_samples(
    request: Request, snuba_params: SnubaParams, orderby: list[str] | None
) -> EventsResponse:
    is_frontend = is_frontend_request(request)
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
        "trace",
    ]

    if lower_bound is None or upper_bound is None:
        bound_results = spans_metrics.query(
            selected_columns=[
                f"p50({column}) as first_bound",
                f"p95({column}) as second_bound",
            ],
            snuba_params=snuba_params,
            query=request.query_params.get("query"),
            referrer=Referrer.API_SPAN_SAMPLE_GET_BOUNDS.value,
            query_source=(QuerySource.FRONTEND if is_frontend else QuerySource.API),
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
        snuba_params=snuba_params,
        query=request.query_params.get("query"),
        sample=options.get("insights.span-samples-query.sample-rate") or None,
        referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_IDS.value,
        query_source=(QuerySource.FRONTEND if is_frontend else QuerySource.API),
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
        user_query = request.query_params.get("query") or ""
        query = f"span_id:[{','.join(span_ids)}] {user_query}"
    else:
        query = request.query_params.get("query") or ""

    return spans_indexed.query(
        selected_columns=selected_columns,
        orderby=orderby,
        snuba_params=snuba_params,
        query=query,
        limit=9,
        referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
        query_source=(QuerySource.FRONTEND if is_frontend else QuerySource.API),
        transform_alias_to_input_format=True,
    )


def get_eap_span_samples(
    request: Request, snuba_params: SnubaParams, orderby: list[str] | None
) -> EAPResponse:
    lower_bound = request.GET.get("lowerBound", 0)
    first_bound = request.GET.get("firstBound")
    second_bound = request.GET.get("secondBound")
    upper_bound = request.GET.get("upperBound")
    column = request.GET.get("column", "span.self_time")

    if first_bound is None or second_bound is None:
        raise ParseError("Must provide first and second bounds")

    selected_columns = request.GET.getlist("additionalFields", []) + [
        "project",
        "transaction.span_id",
        column,
        "timestamp",
        "span_id",
        "profile.id",
        "trace",
    ]

    query_string = request.query_params.get("query") or ""
    bounds_query_string = f"{column}:>{lower_bound}ms {column}:<{upper_bound}ms {query_string}"

    rpc_res = Spans.run_table_query(
        params=snuba_params,
        query_string=bounds_query_string,
        config=SearchResolverConfig(),
        offset=0,
        limit=100,
        sampling_mode=snuba_params.sampling_mode,
        orderby=["-profile.id"],
        referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_IDS.value,
        selected_columns=[
            f"bounded_sample({column}, {lower_bound}, {first_bound}) as lower",
            f"bounded_sample({column}, {first_bound}, {second_bound}) as middle",
            f"bounded_sample({column}, {second_bound}{', ' if upper_bound else ''}{upper_bound}) as top",
            "profile.id",
            "id",
        ],
    )

    span_ids = []

    for row in rpc_res["data"]:
        lower, middle, top = row["lower"], row["middle"], row["top"]
        if lower:
            span_ids.append(row["id"])
        if middle:
            span_ids.append(row["id"])
        if top:
            span_ids.append(row["id"])

    samples_query_string = (
        f"span_id:[{','.join(span_ids)}] {query_string}" if len(span_ids) > 0 else query_string
    )

    return Spans.run_table_query(
        params=snuba_params,
        config=SearchResolverConfig(use_aggregate_conditions=False),
        offset=0,
        limit=9,
        sampling_mode=snuba_params.sampling_mode,
        query_string=samples_query_string,
        orderby=orderby,
        referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
        selected_columns=selected_columns,
    )
