from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Generator, Optional, Sequence, Union, cast

import sentry_sdk
from django.utils import timezone
from django.utils.http import urlquote
from rest_framework.exceptions import APIException, ParseError, ValidationError
from rest_framework.request import Request
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from sentry import features, quotas
from sentry.api.base import LINK_HEADER
from sentry.api.bases import NoProjects, OrganizationEndpoint
from sentry.api.helpers.teams import get_teams
from sentry.api.serializers.snuba import BaseSnubaSerializer, SnubaTSResultSerializer
from sentry.discover.arithmetic import ArithmeticError, is_equation, strip_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.models import Organization, Project, Team
from sentry.models.group import Group
from sentry.search.events.constants import TIMEOUT_ERROR_MESSAGE
from sentry.search.events.fields import get_function_alias
from sentry.search.events.filter import get_filter
from sentry.snuba import discover
from sentry.utils import snuba
from sentry.utils.cursors import Cursor
from sentry.utils.dates import get_interval_from_range, get_rollup_from_request, parse_stats_period
from sentry.utils.http import absolute_uri
from sentry.utils.snuba import MAX_FIELDS, SnubaTSResult


def resolve_axis_column(column: str, index: int = 0) -> str:
    return cast(
        str, get_function_alias(column) if not is_equation(column) else f"equation[{index}]"
    )


class OrganizationEventsEndpointBase(OrganizationEndpoint):  # type: ignore
    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:discover-basic", organization, actor=request.user
        ) or features.has("organizations:performance-view", organization, actor=request.user)

    def get_equation_list(self, organization: Organization, request: Request) -> Sequence[str]:
        """equations have a prefix so that they can be easily included alongside our existing fields"""
        return [
            strip_equation(field) for field in request.GET.getlist("field")[:] if is_equation(field)
        ]

    def get_field_list(self, organization: Organization, request: Request) -> Sequence[str]:
        return [field for field in request.GET.getlist("field")[:] if not is_equation(field)]

    def get_team_ids(self, request: Request, organization: Organization) -> Sequence[int]:
        if not request.user:
            return []

        teams = get_teams(request, organization)
        if not teams:
            teams = Team.objects.get_for_user(organization, request.user)

        return [team.id for team in teams]

    def get_snuba_params(
        self, request: Request, organization: Organization, check_global_views: bool = True
    ) -> Dict[str, Any]:
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params"):
            if (
                len(self.get_field_list(organization, request))
                + len(self.get_equation_list(organization, request))
                > MAX_FIELDS
            ):
                raise ParseError(
                    detail=f"You can view up to {MAX_FIELDS} fields at a time. Please delete some and try again."
                )

            params: Dict[str, Any] = self.get_filter_params(request, organization)
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

    def get_orderby(self, request: Request) -> Optional[Sequence[str]]:
        sort: Sequence[str] = request.GET.getlist("sort")
        if sort:
            return sort
        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby: Sequence[str] = request.GET.getlist("orderby")
        if orderby:
            return orderby
        return None

    def get_snuba_query_args_legacy(
        self, request: Request, organization: Organization
    ) -> Dict[
        str,
        Union[
            Optional[datetime],
            Sequence[Sequence[Union[str, str, Any]]],
            Optional[Dict[str, Sequence[int]]],
        ],
    ]:
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

    def quantize_date_params(self, request: Request, params: Dict[str, Any]) -> Dict[str, Any]:
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
    def handle_query_errors(self) -> Generator[None, None, None]:
        try:
            yield
        except discover.InvalidSearchQuery as error:
            message = str(error)
            # Special case the project message since it has so many variants so tagging is messy otherwise
            if message.endswith("do not exist or are not actively selected."):
                sentry_sdk.set_tag(
                    "query.error_reason", "Project in query does not exist or not selected"
                )
            else:
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
                raise ParseError(detail=TIMEOUT_ERROR_MESSAGE)
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
            else:
                sentry_sdk.capture_exception(error)
            raise APIException(detail=message)


class OrganizationEventsV2EndpointBase(OrganizationEventsEndpointBase):
    def build_cursor_link(self, request: Request, name: str, cursor: Optional[Cursor]) -> str:
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

        return cast(str, LINK_HEADER).format(
            uri=base_url,
            cursor=str(cursor),
            name=name,
            has_results="true" if bool(cursor) else "false",
        )

    def handle_results_with_meta(
        self,
        request: Request,
        organization: Organization,
        project_ids: Sequence[int],
        results: Dict[str, Any],
    ) -> Dict[str, Any]:
        with sentry_sdk.start_span(op="discover.endpoint", description="base.handle_results"):
            data = self.handle_data(request, organization, project_ids, results.get("data"))
            if not data:
                return {"data": [], "meta": {}}
            return {"data": data, "meta": results.get("meta", {})}

    def handle_data(
        self,
        request: Request,
        organization: Organization,
        project_ids: Sequence[int],
        results: Optional[Sequence[Any]],
    ) -> Optional[Sequence[Any]]:
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

    def handle_issues(
        self, results: Sequence[Any], project_ids: Sequence[int], organization: Organization
    ) -> None:
        issue_ids = {row.get("issue.id") for row in results}
        issues = Group.objects.get_issues_mapping(issue_ids, project_ids, organization)
        for result in results:
            if "issue.id" in result:
                result["issue"] = issues.get(result["issue.id"], "unknown")

    def get_event_stats_data(
        self,
        request: Request,
        organization: Organization,
        get_event_stats: Callable[
            [Sequence[str], str, Dict[str, str], int, bool, Optional[timedelta]], SnubaTSResult
        ],
        top_events: int = 0,
        query_column: str = "count()",
        params: Optional[Dict[str, Any]] = None,
        query: Optional[str] = None,
        allow_partial_buckets: bool = False,
        zerofill_results: bool = True,
        comparison_delta: Optional[timedelta] = None,
    ) -> Dict[str, Any]:
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

                try:
                    rollup = get_rollup_from_request(
                        request,
                        params,
                        default_interval=None,
                        error=InvalidSearchQuery(),
                        top_events=top_events,
                    )
                # If the user sends an invalid interval, use the default instead
                except InvalidSearchQuery:
                    sentry_sdk.set_tag("user.invalid_interval", request.GET.get("interval"))
                    date_range = params["end"] - params["start"]
                    stats_period = parse_stats_period(get_interval_from_range(date_range, False))
                    rollup = int(stats_period.total_seconds()) if stats_period is not None else 3600

                if comparison_delta is not None:
                    retention = quotas.get_event_retention(organization=organization)
                    comparison_start = params["start"] - comparison_delta
                    if retention and comparison_start < timezone.now() - timedelta(days=retention):
                        raise ValidationError("Comparison period is outside your retention window")

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
                result = get_event_stats(
                    query_columns, query, params, rollup, zerofill_results, comparison_delta
                )

        serializer = SnubaTSResultSerializer(organization, None, request.user)

        with sentry_sdk.start_span(op="discover.endpoint", description="base.stats_serialization"):
            # When the request is for top_events, result can be a SnubaTSResult in the event that
            # there were no top events found. In this case, result contains a zerofilled series
            # that acts as a placeholder.
            is_multiple_axis = len(query_columns) > 1
            if top_events > 0 and isinstance(result, dict):
                results = {}
                for key, event_result in result.items():
                    if is_multiple_axis:
                        results[key] = self.serialize_multiple_axis(
                            serializer,
                            event_result,
                            columns,
                            query_columns,
                            allow_partial_buckets,
                            zerofill_results=zerofill_results,
                        )
                    else:
                        # Need to get function alias if count is a field, but not the axis
                        results[key] = serializer.serialize(
                            event_result,
                            column=resolve_axis_column(query_columns[0]),
                            allow_partial_buckets=allow_partial_buckets,
                            zerofill_results=zerofill_results,
                        )
                serialized_result = results
            elif is_multiple_axis:
                serialized_result = self.serialize_multiple_axis(
                    serializer,
                    result,
                    columns,
                    query_columns,
                    allow_partial_buckets,
                    zerofill_results=zerofill_results,
                )
            else:
                extra_columns = None
                if comparison_delta:
                    extra_columns = ["comparisonCount"]
                serialized_result = serializer.serialize(
                    result,
                    resolve_axis_column(query_columns[0]),
                    allow_partial_buckets=allow_partial_buckets,
                    zerofill_results=zerofill_results,
                    extra_columns=extra_columns,
                )

            return serialized_result

    def serialize_multiple_axis(
        self,
        serializer: BaseSnubaSerializer,
        event_result: SnubaTSResult,
        columns: Sequence[str],
        query_columns: Sequence[str],
        allow_partial_buckets: bool,
        zerofill_results: bool = True,
    ) -> Dict[str, Any]:
        # Return with requested yAxis as the key
        result = {}
        equations = 0
        for index, query_column in enumerate(query_columns):
            result[columns[index]] = serializer.serialize(
                event_result,
                resolve_axis_column(query_column, equations),
                order=index,
                allow_partial_buckets=allow_partial_buckets,
                zerofill_results=zerofill_results,
            )
            if is_equation(query_column):
                equations += 1
        # Set order if multi-axis + top events
        if "order" in event_result.data:
            result["order"] = event_result.data["order"]

        return result


class KeyTransactionBase(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has("organizations:performance-view", organization, actor=request.user)

    def get_project(self, request: Request, organization: Organization) -> Project:
        projects = self.get_projects(request, organization)

        if len(projects) != 1:
            raise ParseError("Only 1 project per Key Transaction")
        return projects[0]
