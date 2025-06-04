import logging
from concurrent.futures import ThreadPoolExecutor

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.search.events.constants import METRICS_GRANULARITIES
from sentry.seer.breakpoints import detect_breakpoints
from sentry.snuba import metrics_performance
from sentry.snuba.discover import create_result_key, zerofill
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.iterators import chunked
from sentry.utils.performance_issues.detectors.utils import escape_transaction
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


IMPROVED = "improved"
REGRESSION = "regression"
ANY = "any"
TREND_TYPES = [IMPROVED, REGRESSION, ANY]

DEFAULT_TOP_EVENTS_LIMIT = 45
MAX_TOP_EVENTS_LIMIT = 1000
EVENTS_PER_QUERY = 15
DAY_GRANULARITY_IN_SECONDS = METRICS_GRANULARITIES[0]

DEFAULT_RATE_LIMIT = 15
DEFAULT_RATE_LIMIT_WINDOW = 1
DEFAULT_CONCURRENT_RATE_LIMIT = 15
ORGANIZATION_RATE_LIMIT = 30

_query_thread_pool = ThreadPoolExecutor()


@region_silo_endpoint
class OrganizationEventsNewTrendsStatsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(
                DEFAULT_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_CONCURRENT_RATE_LIMIT
            ),
            RateLimitCategory.USER: RateLimit(
                DEFAULT_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, DEFAULT_CONCURRENT_RATE_LIMIT
            ),
            RateLimitCategory.ORGANIZATION: RateLimit(
                ORGANIZATION_RATE_LIMIT, DEFAULT_RATE_LIMIT_WINDOW, ORGANIZATION_RATE_LIMIT
            ),
        }
    }

    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-new-trends", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=f"{trend_type} is not a supported trend type")

        trend_function = request.GET.get("trendFunction", "p50()")

        selected_columns = ["project_id", "transaction"]

        query = request.GET.get("query")
        query_source = self.get_request_source(request)

        def get_top_events(user_query, snuba_params, event_limit, referrer):
            top_event_columns = selected_columns[:]
            top_event_columns.append("count()")

            # Granularity is set to 1d - the highest granularity possible
            # in order to optimize the top event query since we don't care
            # about having exact counts.
            return metrics_query(
                top_event_columns,
                query=user_query,
                snuba_params=snuba_params,
                orderby=["-count()"],
                limit=event_limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                granularity=DAY_GRANULARITY_IN_SECONDS,
                query_source=query_source,
            )

        def generate_top_transaction_query(events):
            pairs = [
                (event["project_id"], escape_transaction(event["transaction"])) for event in events
            ]
            conditions = [
                f'(project_id:{project_id} transaction:"{transaction}")'
                for project_id, transaction in pairs
            ]
            return " OR ".join(conditions)

        def get_timeseries(top_events, _, rollup, zerofill_results):
            # Split top events into multiple queries for bulk timeseries query
            data = top_events["data"]

            queries = [
                generate_top_transaction_query(chunk) for chunk in chunked(data, EVENTS_PER_QUERY)
            ]

            timeseries_columns = selected_columns[:]
            timeseries_columns.append(trend_function)

            # When all projects or my projects options selected,
            # keep only projects that top events belong to to reduce query cardinality
            used_project_ids = set({event["project_id"] for event in data})

            # Get new params with pruned projects
            pruned_snuba_params = self.get_snuba_params(request, organization)
            pruned_snuba_params.projects = [
                project
                for project in pruned_snuba_params.projects
                if project.id in used_project_ids
            ]

            result = metrics_performance.bulk_timeseries_query(
                timeseries_columns,
                queries,
                snuba_params=pruned_snuba_params,
                rollup=rollup,
                zerofill_results=zerofill_results,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_V2_TIMESERIES.value,
                groupby=[Column("project_id"), Column("transaction")],
                apply_formatting=False,
                query_source=query_source,
            )

            # Parse results
            translated_groupby = ["project_id", "transaction"]
            results = {}
            formatted_results = {}
            for index, item in enumerate(data):
                result_key = create_result_key(item, translated_groupby, {})
                results[result_key] = {
                    "order": index,
                    "data": [],
                    "project_id": item["project_id"],
                }

            discarded = 0

            for row in result.get("data", []):
                result_key = create_result_key(row, translated_groupby, {})
                if result_key in results:
                    results[result_key]["data"].append(row)
                else:
                    discarded += 1
                    # TODO: filter out entries that don't have transaction or trend_function
                    logger.warning(
                        "trends.top-events.timeseries.key-mismatch",
                        extra={
                            "result_key": result_key,
                            "top_event_keys": list(results.keys()),
                        },
                    )

            # If we discard any rows, there's a chance we have a bad query and it'll
            # most likely be a transaction name being parsed in an unexpected way in
            # the search.
            # A common side effect of this is that we return data for the same series
            # in more than 1 query which can lead to a validation error in seer.
            if discarded > 0:
                logger.warning(
                    "trends.top-events.timeseries.discarded-rows",
                    extra={
                        "discarded": discarded,
                        "transactions": [event["transaction"] for event in data],
                    },
                )
                sentry_sdk.capture_message("Possibility of bad trends query")

            for key, item in results.items():
                formatted_results[key] = SnubaTSResult(
                    {
                        "data": (
                            zerofill(
                                item["data"],
                                pruned_snuba_params.start_date,
                                pruned_snuba_params.end_date,
                                rollup,
                                ["time"],
                            )
                            if zerofill_results
                            else item["data"]
                        ),
                        "project": item["project_id"],
                        "isMetricsData": True,
                        "order": item["order"],
                    },
                    pruned_snuba_params.start,
                    pruned_snuba_params.end,
                    rollup,
                )
            return formatted_results

        def get_event_stats_metrics(_, user_query, snuba_params, rollup, zerofill_results, __):
            top_event_limit = min(
                int(request.GET.get("topEvents", DEFAULT_TOP_EVENTS_LIMIT)),
                MAX_TOP_EVENTS_LIMIT,
            )

            # Fetch transactions names with the highest event count
            top_trending_transactions = get_top_events(
                user_query=user_query,
                snuba_params=snuba_params,
                event_limit=top_event_limit,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_V2_TOP_EVENTS.value,
            )

            sentry_sdk.set_tag(
                "performance.trendsv2.top_events",
                top_trending_transactions.get("data", None) is not None,
            )
            if len(top_trending_transactions.get("data", [])) == 0:
                return {}

            # Fetch timeseries for each top transaction name
            return get_timeseries(top_trending_transactions, snuba_params, rollup, zerofill_results)

        def format_start_end(data):
            # format start and end
            data_start = data[1].pop("start", "")
            data_end = data[1].pop("end", "")
            # data start and end that analysis is ran on
            data[1]["data_start"] = data_start
            data[1]["data_end"] = data_end
            # user requested start and end
            data[1]["request_start"] = int(snuba_params.start_date.timestamp())
            data[1]["request_end"] = data_end
            return data

        def get_trends_data(stats_data, request):
            stats_data = dict(
                [format_start_end(data) for data in list(stats_data.items()) if data[1] is not None]
            )

            trend_sort = "" if trend_type == ANY else request.GET.get("sort", "trend_percentage()")
            trend_function = request.GET.get("trendFunction", "p50()")

            # list of requests to send to microservice async
            trends_requests = [
                {
                    "data": dict(chunk),
                    "sort": trend_sort,
                    "trendFunction": trend_function,
                }
                for chunk in chunked(stats_data.items(), EVENTS_PER_QUERY)
            ]

            # send the data to microservice
            results = list(_query_thread_pool.map(detect_breakpoints, trends_requests))
            trend_results = []

            # append all the results
            for result in results:
                output_dict = result["data"]
                trend_results += output_dict

            # sort the results into trending events list
            if trend_sort == "trend_percentage()":
                trending_events = sorted(trend_results, key=lambda d: d["trend_percentage"])
            elif trend_sort == "-trend_percentage()":
                trending_events = sorted(
                    trend_results, key=lambda d: d["trend_percentage"], reverse=True
                )
            else:
                trending_events = sorted(
                    trend_results, key=lambda d: d["absolute_percentage_change"], reverse=True
                )

            sentry_sdk.set_tag("performance.trendsv2.trends", len(trending_events) > 0)

            return trending_events, trends_requests

        def paginate_trending_events(offset, limit):
            return {"data": trending_events[offset : limit + offset]}

        def get_stats_data_for_trending_events(results):
            trending_transaction_names_stats = {}
            if request.GET.get("withTimeseries", False):
                trending_transaction_names_stats = stats_data
            else:
                for t in results["data"]:
                    transaction_name = t["transaction"]
                    project = t["project"]
                    t_p_key = f"{project},{transaction_name}"
                    if t_p_key in stats_data:
                        selected_stats_data = stats_data[t_p_key]
                        idx = next(
                            i
                            for i, data in enumerate(selected_stats_data["data"])
                            if data[0] >= snuba_params.start_date.timestamp()
                        )
                        parsed_stats_data = selected_stats_data["data"][idx:]
                        selected_stats_data["data"] = parsed_stats_data
                        trending_transaction_names_stats[t_p_key] = selected_stats_data
                    else:
                        logger.warning(
                            "trends.trends-request.timeseries.key-mismatch",
                            extra={"result_key": t_p_key, "timeseries_keys": stats_data.keys()},
                        )

            return {
                "events": self.handle_results_with_meta(
                    request,
                    organization,
                    snuba_params.project_ids,
                    {"data": results["data"], "meta": {"isMetricsData": True}},
                    True,
                ),
                "stats": trending_transaction_names_stats,
            }

        with handle_query_errors():
            stats_data = self.get_event_stats_data(
                request,
                organization,
                get_event_stats_metrics,
                top_events=EVENTS_PER_QUERY,
                query_column=trend_function,
                snuba_params=snuba_params,
                query=query,
            )

            sentry_sdk.set_tag("performance.trendsv2.stats_data", bool(stats_data))

            # Handle empty response
            if not bool(stats_data):
                return Response(
                    {
                        "events": self.handle_results_with_meta(
                            request,
                            organization,
                            snuba_params.project_ids,
                            {"data": [], "meta": {"isMetricsData": True}},
                            True,
                        ),
                        "stats": {},
                    },
                    status=200,
                )

            (
                trending_events,
                trends_requests,
            ) = get_trends_data(stats_data, request)

            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=paginate_trending_events),
                on_results=get_stats_data_for_trending_events,
                default_per_page=5,
                max_per_page=5,
            )
