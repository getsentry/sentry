import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, cast

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
from sentry.search.events.constants import METRICS_GRANULARITIES
from sentry.seer.utils import detect_breakpoints
from sentry.snuba import metrics_performance
from sentry.snuba.discover import create_result_key, zerofill
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.snuba.referrer import Referrer
from sentry.types.ratelimit import RateLimit, RateLimitCategory
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
ONE_DAY_IN_SECONDS = 24 * 60 * 60  # 86,400 seconds

DEFAULT_RATE_LIMIT = 15
DEFAULT_RATE_LIMIT_WINDOW = 1
DEFAULT_CONCURRENT_RATE_LIMIT = 15
ORGANIZATION_RATE_LIMIT = 30

_query_thread_pool = ThreadPoolExecutor()


@region_silo_endpoint
class OrganizationEventsNewTrendsStatsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
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
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=f"{trend_type} is not a supported trend type")

        trend_function = request.GET.get("trendFunction", "p50()")

        selected_columns = self.get_field_list(organization, request)

        query = request.GET.get("query")

        top_trending_transactions = {}

        experiment_use_project_id = features.has(
            "organizations:performance-trendsv2-dev-only",
            organization,
            actor=request.user,
        )

        def get_top_events(user_query, params, event_limit, referrer):
            top_event_columns = cast(List[str], selected_columns[:])
            top_event_columns.append("count()")
            top_event_columns.append("project_id")

            # Granularity is set to 1d - the highest granularity possible
            # in order to optimize the top event query since we don't care
            # about having exact counts.
            return metrics_query(
                top_event_columns,
                query=user_query,
                params=params,
                orderby=["-count()"],
                limit=event_limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                granularity=DAY_GRANULARITY_IN_SECONDS,
            )

        def generate_top_transaction_query(events):
            top_transaction_names = [
                re.sub(r'"', '\\"', event.get("transaction")) for event in events
            ]
            top_transaction_as_str = ", ".join(
                f'"{transaction}"' for transaction in top_transaction_names
            )
            return f"transaction:[{top_transaction_as_str}]"

        def get_timeseries(top_events, _, rollup, zerofill_results):
            # Split top events into multiple queries for bulk timeseries query
            data = top_events["data"]
            split_top_events = [
                data[i : i + EVENTS_PER_QUERY] for i in range(0, len(data), EVENTS_PER_QUERY)
            ]
            queries = [generate_top_transaction_query(t_e) for t_e in split_top_events]

            timeseries_columns = cast(List[str], selected_columns[:])
            timeseries_columns.append(trend_function)

            # When all projects or my projects options selected,
            # keep only projects that top events belong to to reduce query cardinality
            used_project_ids = list({event["project"] for event in data})

            request.GET.projectSlugs = used_project_ids  # type: ignore

            # Get new params with pruned projects
            pruned_params = self.get_snuba_params(request, organization)

            result = metrics_performance.bulk_timeseries_query(
                timeseries_columns,
                queries,
                pruned_params,
                rollup=rollup,
                zerofill_results=zerofill_results,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_V2_TIMESERIES.value,
                groupby=Column("transaction"),
                apply_formatting=False,
            )

            # Parse results
            translated_groupby = ["transaction"]
            results = {}
            formatted_results = {}
            for index, item in enumerate(top_events["data"]):
                result_key = create_result_key(item, translated_groupby, {})
                if experiment_use_project_id:
                    results[result_key] = {
                        "order": index,
                        "data": [],
                        "project_id": item["project_id"],
                    }
                else:
                    results[result_key] = {
                        "order": index,
                        "data": [],
                        "project": item["project"],
                    }
            for row in result.get("data", []):  # type: ignore
                result_key = create_result_key(row, translated_groupby, {})
                if result_key in results:
                    results[result_key]["data"].append(row)
                else:
                    # TODO filter out entries that don't have transaction or trend_function
                    logger.warning(
                        "trends.top-events.timeseries.key-mismatch",
                        extra={
                            "result_key": result_key,
                            "top_event_keys": list(results.keys()),
                        },
                    )
            for key, item in results.items():
                key = (
                    f'{item["project_id"]},{key}'
                    if experiment_use_project_id
                    else f'{item["project"]},{key}'
                )
                formatted_results[key] = SnubaTSResult(
                    {
                        "data": zerofill(
                            item["data"],
                            pruned_params["start"],
                            pruned_params["end"],
                            rollup,
                            "time",
                        )
                        if zerofill_results
                        else item["data"],
                        "project": item["project_id"]
                        if experiment_use_project_id
                        else item["project"],
                        "isMetricsData": True,
                        "order": item["order"],
                    },
                    pruned_params["start"],
                    pruned_params["end"],
                    rollup,
                )
            return formatted_results

        def get_event_stats_metrics(_, user_query, params, rollup, zerofill_results, __):
            top_event_limit = min(
                int(request.GET.get("topEvents", DEFAULT_TOP_EVENTS_LIMIT)),
                MAX_TOP_EVENTS_LIMIT,
            )

            # Fetch transactions names with the highest event count
            nonlocal top_trending_transactions
            top_trending_transactions = get_top_events(
                user_query=user_query,
                params=params,
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
            return get_timeseries(top_trending_transactions, params, rollup, zerofill_results)

        def format_start_end(data):
            # format start and end
            data_start = data[1].pop("start", "")
            data_end = data[1].pop("end", "")
            # data start and end that analysis is ran on
            data[1]["data_start"] = data_start
            data[1]["data_end"] = data_end
            # user requested start and end
            data[1]["request_start"] = params["start"].timestamp()
            data[1]["request_end"] = data_end
            return data

        def get_trends_data(stats_data, request):
            trend_function = request.GET.get("trendFunction", "p50()")

            trends_request: Dict[str, Any] = {
                "data": {},
                "sort": None,
                "trendFunction": None,
            }

            trends_request["sort"] = (
                "" if trend_type == ANY else request.GET.get("sort", "trend_percentage()")
            )
            trends_request["trendFunction"] = trend_function

            # list of requests to send to microservice async
            trends_requests = []

            stats_data = dict(
                [format_start_end(data) for data in list(stats_data.items()) if data[1] is not None]
            )

            # split the txns data into multiple dictionaries
            split_transactions_data = [
                dict(list(stats_data.items())[i : i + EVENTS_PER_QUERY])
                for i in range(0, len(stats_data), EVENTS_PER_QUERY)
            ]

            for i in range(len(split_transactions_data)):
                trends_request = trends_request.copy()
                trends_request["data"] = split_transactions_data[i]
                trends_requests.append(trends_request)

            # send the data to microservice
            results = list(_query_thread_pool.map(detect_breakpoints, trends_requests))
            trend_results = []

            # append all the results
            for result in results:
                output_dict = result["data"]
                trend_results += output_dict

            # sort the results into trending events list
            if trends_request["sort"] == "trend_percentage()":
                trending_events = sorted(trend_results, key=lambda d: d["trend_percentage"])
            elif trends_request["sort"] == "-trend_percentage()":
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
                            if data[0] >= params["start"].timestamp()
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
                    params["project_id"],
                    {"data": results["data"], "meta": {"isMetricsData": True}},
                    True,
                ),
                "stats": trending_transaction_names_stats,
                # temporary change to see what stats data is returned
                "raw_stats": trends_requests
                if features.has(
                    "organizations:performance-trendsv2-dev-only",
                    organization,
                    actor=request.user,
                )
                else {},
            }

        with self.handle_query_errors():
            stats_data = self.get_event_stats_data(
                request,
                organization,
                get_event_stats_metrics,
                top_events=EVENTS_PER_QUERY,
                query_column=trend_function,
                params=params,
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
                            params["project_id"],
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
