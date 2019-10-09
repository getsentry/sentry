from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry import eventstore
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import (
    get_filter,
    resolve_field_list,
    InvalidSearchQuery,
    get_reference_event_conditions,
)
from sentry.models.project import Project
from sentry.utils import snuba


class Direction(object):
    NEXT = 0
    PREV = 1


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def get_snuba_query_args(self, request, organization, params):
        query = request.GET.get("query")
        try:
            filter = get_filter(query, params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        snuba_args = {
            "start": filter.start,
            "end": filter.end,
            "conditions": filter.conditions,
            "filter_keys": filter.filter_keys,
        }

        sort = request.GET.getlist("sort")
        if sort:
            snuba_args["orderby"] = sort

        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist("orderby")
        if orderby and "orderby" not in snuba_args:
            snuba_args["orderby"] = orderby

        if request.GET.get("rollup"):
            try:
                snuba_args["rollup"] = int(request.GET.get("rollup"))
            except ValueError:
                raise OrganizationEventsError("rollup must be an integer.")

        fields = request.GET.getlist("field")[:]
        if fields:
            try:
                snuba_args.update(resolve_field_list(fields, snuba_args))
            except InvalidSearchQuery as exc:
                raise OrganizationEventsError(exc.message)

        reference_event_id = request.GET.get("referenceEvent")
        if reference_event_id:
            snuba_args["conditions"] = get_reference_event_conditions(
                snuba_args, reference_event_id
            )

        return snuba_args

    def get_snuba_query_args_legacy(self, request, organization):
        params = self.get_filter_params(request, organization)

        group_ids = request.GET.getlist("group")
        if group_ids:
            # TODO(mark) This parameter should be removed in the long term.
            # Instead of using this parameter clients should use `issue.id`
            # in their query string.
            try:
                group_ids = set(map(int, filter(None, group_ids)))
            except ValueError:
                raise OrganizationEventsError("Invalid group parameter. Values must be numbers")

            projects = Project.objects.filter(
                organization=organization, group__id__in=group_ids
            ).distinct()
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied
            params["issue.id"] = list(group_ids)
            params["project_id"] = list(set([p.id for p in projects] + params["project_id"]))

        query = request.GET.get("query")
        try:
            _filter = get_filter(query, params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        snuba_args = {
            "start": _filter.start,
            "end": _filter.end,
            "conditions": _filter.conditions,
            "filter_keys": _filter.filter_keys,
        }

        # 'legacy' endpoints cannot access transactions dataset.
        # as they often have assumptions about which columns are returned.
        dataset = snuba.detect_dataset(snuba_args, aliased_conditions=True)
        if dataset != snuba.Dataset.Events:
            raise OrganizationEventsError(
                "Invalid query. You cannot reference non-events data in this endpoint."
            )

        return snuba_args

    def next_event_id(self, snuba_args, event):
        """
        Returns the next event ID if there is a subsequent event matching the
        conditions provided. Ignores the project_id.
        """
        next_event = eventstore.get_next_event_id(event, filter=self._get_filter(snuba_args))

        if next_event:
            return next_event[1]

    def prev_event_id(self, snuba_args, event):
        """
        Returns the previous event ID if there is a previous event matching the
        conditions provided. Ignores the project_id.
        """
        prev_event = eventstore.get_prev_event_id(event, filter=self._get_filter(snuba_args))

        if prev_event:
            return prev_event[1]

    def _get_filter(self, snuba_args):
        return eventstore.Filter(
            conditions=snuba_args["conditions"],
            start=snuba_args.get("start", None),
            end=snuba_args.get("end", None),
            project_ids=snuba_args["filter_keys"].get("project_id", None),
            group_ids=snuba_args["filter_keys"].get("issue", None),
        )

    def oldest_event_id(self, snuba_args, event):
        """
        Returns the oldest event ID if there is a subsequent event matching the
        conditions provided
        """
        return self._get_terminal_event_id(Direction.PREV, snuba_args, event)

    def latest_event_id(self, snuba_args, event):
        """
        Returns the latest event ID if there is a newer event matching the
        conditions provided
        """
        return self._get_terminal_event_id(Direction.NEXT, snuba_args, event)

    def _get_terminal_event_id(self, direction, snuba_args, event):
        if direction == Direction.NEXT:
            time_condition = [["timestamp", ">", event.timestamp]]
            orderby = ["-timestamp", "-event_id"]
        else:
            time_condition = [["timestamp", "<", event.timestamp]]
            orderby = ["timestamp", "event_id"]

        conditions = snuba_args["conditions"][:]
        conditions.extend(time_condition)

        result = snuba.dataset_query(
            selected_columns=["event_id"],
            start=snuba_args.get("start", None),
            end=snuba_args.get("end", None),
            conditions=conditions,
            dataset=snuba.detect_dataset(snuba_args, aliased_conditions=True),
            filter_keys=snuba_args["filter_keys"],
            orderby=orderby,
            limit=1,
        )
        if not result or "data" not in result or len(result["data"]) == 0:
            return None

        return result["data"][0]["event_id"]
