import re

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import search
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import parse_search_query
from sentry.api.helpers.group_index import build_query_params_from_request
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.snuba import discover, spans_indexed
from sentry.snuba.referrer import Referrer


@region_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        dataset = self.get_dataset(request)

        with self.handle_query_errors():
            result = dataset.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )

        return Response({"count": result["data"][0]["count"]})


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
class OrganizationSamplesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization) -> Response:
        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({})

        dataset_field_mapping = {
            discover: {
                "duration_column": "transaction.duration",
                "id": "id",
            },
            spans_indexed: {
                "duration_column": "span.self_time",
                "id": "span_id",
            },
        }

        dataset = self.get_dataset(request, "spansIndexed")
        if dataset not in dataset_field_mapping.keys():
            raise ParseError("Requested dataset is not supported")
        dataset_fields = dataset_field_mapping[dataset]

        buckets = request.GET.get("intervals", 3)
        first_bound = request.GET.get("firstBound")
        second_bound = request.GET.get("secondBound")
        seed = request.GET.get("seed")

        try:
            lower_bound = int(request.GET.get("lowerBound", 0))
            upper_bound = int(request.GET.get("upperBound"))
        except ValueError:
            raise ParseError("lower and upper bound both must be numbers")
        column = request.GET.get("column", dataset_fields["duration_column"])

        if lower_bound is None or upper_bound is None:
            raise ParseError("Could not find bounds")

        if first_bound is None:
            first_bound = lower_bound + (upper_bound - lower_bound) * (1 / 3)
        if second_bound is None:
            second_bound = lower_bound + (upper_bound - lower_bound) * (2 / 3)

        seed_param = f", {seed}" if seed else ""
        result = dataset.query(
            selected_columns=[
                f"bounded_sample({column}, {lower_bound}, {first_bound}{seed_param}) as lower",
                f"bounded_sample({column}, {first_bound}, {second_bound}{seed_param}) as middle",
                f"bounded_sample({column}, {second_bound}{', ' if upper_bound else ''}{upper_bound}{seed_param}) as top",
                f"rounded_time({buckets})",
            ],
            params=params,
            query=request.query_params.get("query"),
            referrer=Referrer.API_SAMPLE_GET_IDS.value,
        )
        ids = []
        for row in result["data"]:
            lower, middle, top = row["lower"], row["middle"], row["top"]
            if lower:
                ids.append(lower)
            if middle:
                ids.append(middle)
            if top:
                ids.append(top)

        if len(ids) > 0:
            query_extra = request.query_params.get("query")
            query = f"{dataset_fields['id']}:[{','.join(ids)}] {query_extra if query_extra else ''}"
        else:
            query = request.query_params.get("query")

        result = dataset.query(
            selected_columns=[
                "project",
                "transaction.id",
                column,
                "timestamp",
                dataset_fields["id"],
            ],
            orderby=["timestamp"],
            params=params,
            query=query,
            limit=9,
            referrer=Referrer.API_SAMPLE_GET_DATA.value,
        )
        return Response({"data": result["data"]})
