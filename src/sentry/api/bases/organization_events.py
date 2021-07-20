from contextlib import contextmanager
from typing import Sequence

import sentry_sdk
from django.http import HttpRequest
from django.utils.http import urlquote
from rest_framework.exceptions import APIException, ParseError
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from sentry import features
from sentry.api.base import LINK_HEADER
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.helpers.teams import get_teams
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.discover.arithmetic import ArithmeticError, is_equation, strip_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization, Team
from sentry.models.group import Group
from sentry.search.events.fields import get_function_alias
from sentry.search.events.filter import get_filter
from sentry.snuba import discover
from sentry.utils import snuba
from sentry.utils.dates import get_rollup_from_request
from sentry.utils.http import absolute_uri
from sentry.utils.snuba import MAX_FIELDS


def resolve_axis_column(column: str, index=0) -> str:
    return get_function_alias(column) if not is_equation(column) else f"equation[{index}]"


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover-basic", organization, actor=request.user
        ) or features.has("organizations:performance-view", organization, actor=request.user)

    def has_arithmetic(self, organization, request):
        return features.has("organizations:discover-arithmetic", organization, actor=request.user)

    def get_equation_list(self, organization: Organization, request: HttpRequest) -> Sequence[str]:
        """equations have a prefix so that they can be easily included alongside our existing fields"""
        if self.has_arithmetic(organization, request):
            return [
                strip_equation(field)
                for field in request.GET.getlist("field")[:]
                if is_equation(field)
            ]
        else:
            return []

    def get_field_list(self, organization: Organization, request: HttpRequest) -> Sequence[str]:
        if self.has_arithmetic(organization, request):
            return [field for field in request.GET.getlist("field")[:] if not is_equation(field)]
        else:
            return request.GET.getlist("field")[:]

    def get_snuba_filter(self, request, organization, params=None):
        if params is None:
            params = self.get_snuba_params(request, organization)
        query = request.GET.get("query")
        try:
            return get_filter(query, params)
        except InvalidSearchQuery as e:
            raise ParseError(detail=str(e))

    def get_team_ids(self, request, organization):
        if not request.user:
            return []

        teams = get_teams(request, organization)
        if not teams:
            teams = Team.objects.get_for_user(organization, request.user)

        return [team.id for team in teams]

    def get_snuba_params(self, request, organization, check_global_views=True):
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params"):
            if (
                len(self.get_field_list(organization, request))
                + len(self.get_equation_list(organization, request))
                > MAX_FIELDS
            ):
                raise ParseError(
                    detail=f"You can view up to {MAX_FIELDS} fields at a time. Please delete some and try again."
                )

            params = self.get_filter_params(request, organization)
            params = self.quantize_date_params(request, params)
            params["user_id"] = request.user.id if request.user else None
            params["team_id"] = self.get_team_ids(request, organization)

            if check_global_views:
                has_global_views = features.has(
                    "organizations:global-views", organization, actor=request.user
                )
                if not has_global_views and len(params.get("project_id", [])) > 1:
                    raise ParseError(detail="You cannot view events from multiple projects.")

            return params

    def get_orderby(self, request):
        sort = request.GET.getlist("sort")
        if sort:
            return sort
        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist("orderby")
        if orderby:
            return orderby

    def get_snuba_query_args_legacy(self, request, organization):
        params = self.get_filter_params(request, organization)
        query = request.GET.get("query")
        try:
            _filter = get_filter(query, params)
        except InvalidSearchQuery as e:
            raise ParseError(detail=str(e))

        snuba_args = {
            "start": _filter.start,
            "end": _filter.end,
            "conditions": _filter.conditions,
            "filter_keys": _filter.filter_keys,
        }

        return snuba_args

    def quantize_date_params(self, request, params):
        # We only need to perform this rounding on relative date periods
        if "statsPeriod" not in request.GET:
            return params
        results = params.copy()
        duration = (params["end"] - params["start"]).total_seconds()
        # Only perform rounding on durations longer than an hour
        if duration > 3600:
            # Round to 15 minutes if over 30 days, otherwise round to the minute
            round_to = 15 * 60 if duration >= 30 * 24 * 3600 else 60
            for key in ["start", "end"]:
                results[key] = snuba.quantize_time(
                    params[key], params.get("organization_id", 0), duration=round_to
                )
        return results

    @contextmanager
    def handle_query_errors(self):
        try:
            yield
        except discover.InvalidSearchQuery as error:
            message = str(error)
            sentry_sdk.set_tag("query.error_reason", message)
            raise ParseError(detail=message)
        except ArithmeticError as error:
            message = str(error)
            sentry_sdk.set_tag("query.error_reason", message)
            raise ParseError(detail=message)
        except snuba.QueryOutsideRetentionError as error:
            sentry_sdk.set_tag("query.error_reason", "QueryOutsideRetentionError")
            raise ParseError(detail=str(error))
        except snuba.QueryIllegalTypeOfArgument:
            message = "Invalid query. Argument to function is wrong type."
            sentry_sdk.set_tag("query.error_reason", message)
            raise ParseError(detail=message)
        except snuba.SnubaError as error:
            message = "Internal error. Please try again."
            if isinstance(
                error,
                (
                    snuba.RateLimitExceeded,
                    snuba.QueryMemoryLimitExceeded,
                    snuba.QueryExecutionTimeMaximum,
                    snuba.QueryTooManySimultaneous,
                ),
            ):
                sentry_sdk.set_tag("query.error_reason", "Timeout")
                raise ParseError(
                    detail="Query timeout. Please try again. If the problem persists try a smaller date range or fewer projects."
                )
            elif isinstance(error, (snuba.UnqualifiedQueryError)):
                sentry_sdk.set_tag("query.error_reason", str(error))
                raise ParseError(detail=str(error))
            elif isinstance(
                error,
                (
                    snuba.DatasetSelectionError,
                    snuba.QueryConnectionFailed,
                    snuba.QueryExecutionError,
                    snuba.QuerySizeExceeded,
                    snuba.SchemaValidationError,
                    snuba.QueryMissingColumn,
                ),
            ):
                sentry_sdk.capture_exception(error)
                message = "Internal error. Your query failed to run."
            raise APIException(detail=message)


class OrganizationEventsV2EndpointBase(OrganizationEventsEndpointBase):
    def build_cursor_link(self, request, name, cursor):
        # The base API function only uses the last query parameter, but this endpoint
        # needs all the parameters, particularly for the "field" query param.
        querystring = "&".join(
            f"{urlquote(query[0])}={urlquote(value)}"
            for query in request.GET.lists()
            if query[0] != "cursor"
            for value in query[1]
        )

        base_url = absolute_uri(urlquote(request.path))
        if querystring:
            base_url = f"{base_url}?{querystring}"
        else:
            base_url = base_url + "?"

        return LINK_HEADER.format(
            uri=base_url,
            cursor=str(cursor),
            name=name,
            has_results="true" if bool(cursor) else "false",
        )

    def handle_results_with_meta(self, request, organization, project_ids, results):
        with sentry_sdk.start_span(op="discover.endpoint", description="base.handle_results"):
            data = self.handle_data(request, organization, project_ids, results.get("data"))
            if not data:
                return {"data": [], "meta": {}}
            return {"data": data, "meta": results.get("meta", {})}

    def handle_data(self, request, organization, project_ids, results):
        if not results:
            return results

        first_row = results[0]

        # TODO(mark) move all of this result formatting into discover.query()
        # once those APIs are used across the application.
        if "transaction.status" in first_row:
            for row in results:
                row["transaction.status"] = SPAN_STATUS_CODE_TO_NAME.get(row["transaction.status"])

        fields = self.get_field_list(organization, request)
        if "issue" in fields:  # Look up the short ID and return that in the results
            self.handle_issues(results, project_ids, organization)

        if not ("project.id" in first_row or "projectid" in first_row):
            return results

        for result in results:
            for key in ("projectid", "project.id"):
                if key in result and key not in fields:
                    del result[key]

        return results

    def handle_issues(self, results, project_ids, organization):
        issue_ids = {row.get("issue.id") for row in results}
        issues = Group.issues_mapping(issue_ids, project_ids, organization)
        for result in results:
            if "issue.id" in result:
                result["issue"] = issues.get(result["issue.id"], "unknown")

    def get_event_stats_data(
        self,
        request,
        organization,
        get_event_stats,
        top_events=0,
        query_column="count()",
        params=None,
        query=None,
        allow_partial_buckets=False,
    ):
        with self.handle_query_errors():
            with sentry_sdk.start_span(
                op="discover.endpoint", description="base.stats_query_creation"
            ):
                columns = request.GET.getlist("yAxis", [query_column])
                if query is None:
                    query = request.GET.get("query")
                if params is None:
                    try:
                        # events-stats is still used by events v1 which doesn't require global views
                        params = self.get_snuba_params(
                            request, organization, check_global_views=False
                        )
                    except NoProjects:
                        return {"data": []}

                rollup = get_rollup_from_request(
                    request,
                    params,
                    default_interval=None,
                    error=InvalidSearchQuery(
                        "Your interval and date range would create too many results. "
                        "Use a larger interval, or a smaller date range."
                    ),
                    top_events=top_events,
                )
                # Backwards compatibility for incidents which uses the old
                # column aliases as it straddles both versions of events/discover.
                # We will need these aliases until discover2 flags are enabled for all
                # users.
                # We need these rollup columns to generate correct events-stats results
                column_map = {
                    "user_count": "count_unique(user)",
                    "event_count": "count()",
                    "epm()": "epm(%d)" % rollup,
                    "eps()": "eps(%d)" % rollup,
                    "tpm()": "tpm(%d)" % rollup,
                    "tps()": "tps(%d)" % rollup,
                }

                query_columns = [column_map.get(column, column) for column in columns]
            with sentry_sdk.start_span(op="discover.endpoint", description="base.stats_query"):
                result = get_event_stats(query_columns, query, params, rollup)

        serializer = SnubaTSResultSerializer(organization, None, request.user)

        with sentry_sdk.start_span(op="discover.endpoint", description="base.stats_serialization"):
            # When the request is for top_events, result can be a SnubaTSResult in the event that
            # there were no top events found. In this case, result contains a zerofilled series
            # that acts as a placeholder.
            if top_events > 0 and isinstance(result, dict):
                results = {}
                for key, event_result in result.items():
                    if len(query_columns) > 1:
                        results[key] = self.serialize_multiple_axis(
                            serializer, event_result, columns, query_columns, allow_partial_buckets
                        )
                    else:
                        # Need to get function alias if count is a field, but not the axis
                        results[key] = serializer.serialize(
                            event_result,
                            column=resolve_axis_column(query_columns[0]),
                            allow_partial_buckets=allow_partial_buckets,
                        )
                return results
            elif len(query_columns) > 1:
                return self.serialize_multiple_axis(
                    serializer, result, columns, query_columns, allow_partial_buckets
                )
            else:
                return serializer.serialize(
                    result,
                    resolve_axis_column(query_columns[0]),
                    allow_partial_buckets=allow_partial_buckets,
                )

    def serialize_multiple_axis(
        self, serializer, event_result, columns, query_columns, allow_partial_buckets
    ):
        # Return with requested yAxis as the key
        result = {}
        equations = 0
        for index, query_column in enumerate(query_columns):
            result[columns[index]] = serializer.serialize(
                event_result,
                resolve_axis_column(query_column, equations),
                order=index,
                allow_partial_buckets=allow_partial_buckets,
            )
            if is_equation(query_column):
                equations += 1
        # Set order if multi-axis + top events
        if "order" in event_result.data:
            result["order"] = event_result.data["order"]
        return result


class KeyTransactionBase(OrganizationEventsV2EndpointBase):
    def has_feature(self, request, organization):
        return features.has("organizations:performance-view", organization, actor=request.user)

    def get_project(self, request, organization):
        projects = self.get_projects(request, organization)

        if len(projects) != 1:
            raise ParseError("Only 1 project per Key Transaction")
        return projects[0]
