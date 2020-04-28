from __future__ import absolute_import

import six
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ParseError


from sentry import features
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import (
    get_filter,
    InvalidSearchQuery,
    get_json_meta_type,
    get_function_alias,
)
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.models.project import Project
from sentry.models.group import Group
from sentry.snuba import discover
from sentry.utils.compat import map
from sentry.utils.dates import get_rollup_from_request
from sentry.utils import snuba


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def get_snuba_filter(self, request, organization, params=None):
        if params is None:
            params = self.get_filter_params(request, organization)
        query = request.GET.get("query")
        try:
            return get_filter(query, params)
        except InvalidSearchQuery as e:
            raise OrganizationEventsError(six.text_type(e))

    def get_orderby(self, request):
        sort = request.GET.getlist("sort")
        if sort:
            return sort
        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist("orderby")
        if orderby:
            return orderby

    def reference_event(self, request, organization, start, end):
        fields = request.GET.getlist("field")[:]
        reference_event_id = request.GET.get("referenceEvent")
        if reference_event_id:
            return discover.ReferenceEvent(organization, reference_event_id, fields, start, end)

    def get_snuba_query_args_legacy(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = request.GET.getlist("group")
        if group_ids:
            # TODO(mark) This parameter should be removed in the long term.
            # Instead of using this parameter clients should use `issue.id`
            # in their query string.
            try:
                group_ids = set(map(int, [_f for _f in group_ids if _f]))
            except ValueError:
                raise OrganizationEventsError("Invalid group parameter. Values must be numbers")

            projects = Project.objects.filter(
                organization=organization, group__id__in=group_ids
            ).distinct()
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied
            params["group_ids"] = list(group_ids)
            params["project_id"] = list(set([p.id for p in projects] + params["project_id"]))

        query = request.GET.get("query")
        try:
            _filter = get_filter(query, params)
        except InvalidSearchQuery as e:
            raise OrganizationEventsError(six.text_type(e))

        snuba_args = {
            "start": _filter.start,
            "end": _filter.end,
            "conditions": _filter.conditions,
            "filter_keys": _filter.filter_keys,
        }

        return snuba_args


class OrganizationEventsV2EndpointBase(OrganizationEventsEndpointBase):
    def handle_results_with_meta(self, request, organization, project_ids, results):
        data = self.handle_data(request, organization, project_ids, results.get("data"))
        if not data:
            return {"data": [], "meta": {}}

        meta = {
            value["name"]: get_json_meta_type(value["name"], value["type"])
            for value in results["meta"]
        }
        # Ensure all columns in the result have types.
        for key in data[0]:
            if key not in meta:
                meta[key] = "string"
        return {"meta": meta, "data": data}

    def handle_data(self, request, organization, project_ids, results):
        if not results:
            return results

        first_row = results[0]

        # TODO(mark) move all of this result formatting into discover.query()
        # once those APIs are used across the application.
        if "transaction.status" in first_row:
            for row in results:
                row["transaction.status"] = SPAN_STATUS_CODE_TO_NAME.get(row["transaction.status"])

        fields = request.GET.getlist("field")
        if "issue" in fields:  # Look up the short ID and return that in the results
            issue_ids = set(row.get("issue.id") for row in results)
            issues = Group.issues_mapping(issue_ids, project_ids, organization)
            for result in results:
                if "issue.id" in result:
                    result["issue"] = issues.get(result["issue.id"], "unknown")

        if not ("project.id" in first_row or "projectid" in first_row):
            return results

        for result in results:
            for key in ("projectid", "project.id"):
                if key in result:
                    if key not in fields:
                        del result[key]

        return results

    def get_event_stats_data(self, request, organization, get_event_stats, top_events=False):
        try:
            columns = request.GET.getlist("yAxis", ["count()"])
            query = request.GET.get("query")
            params = self.get_filter_params(request, organization)
            rollup = get_rollup_from_request(
                request,
                params,
                "1h",
                InvalidSearchQuery(
                    "Your interval and date range would create too many results. "
                    "Use a larger interval, or a smaller date range."
                ),
            )
            # Backwards compatibility for incidents which uses the old
            # column aliases as it straddles both versions of events/discover.
            # We will need these aliases until discover2 flags are enabled for all
            # users.
            column_map = {
                "user_count": "count_unique(user)",
                "event_count": "count()",
                "rpm()": "rpm(%d)" % rollup,
                "rps()": "rps(%d)" % rollup,
            }
            query_columns = [column_map.get(column, column) for column in columns]
            reference_event = self.reference_event(
                request, organization, params.get("start"), params.get("end")
            )

            result = get_event_stats(query_columns, query, params, rollup, reference_event)
        except (discover.InvalidSearchQuery, snuba.QueryOutsideRetentionError) as error:
            raise ParseError(detail=six.text_type(error))
        serializer = SnubaTSResultSerializer(organization, None, request.user)

        if top_events:
            results = {}
            for key, event_result in six.iteritems(result):
                if len(query_columns) > 1:
                    results[key] = self.serialize_multiple_axis(
                        serializer, event_result, columns, query_columns
                    )
                else:
                    # Need to get function alias if count is a field, but not the axis
                    results[key] = serializer.serialize(
                        event_result, get_function_alias(query_columns[0])
                    )
            return results
        elif len(query_columns) > 1:
            return self.serialize_multiple_axis(serializer, result, columns, query_columns)
        else:
            return serializer.serialize(result)

    def serialize_multiple_axis(self, serializer, event_result, columns, query_columns):
        # Return with requested yAxis as the key
        result = {
            columns[index]: serializer.serialize(
                event_result, get_function_alias(query_column), order=index
            )
            for index, query_column in enumerate(query_columns)
        }
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
