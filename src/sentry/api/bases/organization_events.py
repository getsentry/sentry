from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import get_filter, InvalidSearchQuery
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import ReferenceEvent
from sentry.utils import snuba


class OrganizationEventsEndpointBase(OrganizationEndpoint):
    def get_snuba_filter(self, request, organization, params=None):
        if params is None:
            params = self.get_filter_params(request, organization)
        query = request.GET.get("query")
        try:
            return get_filter(query, params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

    def get_orderby(self, request):
        sort = request.GET.getlist("sort")
        if sort:
            return sort
        # Deprecated. `sort` should be used as it is supported by
        # more endpoints.
        orderby = request.GET.getlist("orderby")
        if orderby:
            return orderby

    def reference_event(self, request, organization):
        fields = request.GET.getlist("field")[:]
        reference_event_id = request.GET.get("referenceEvent")
        if reference_event_id:
            return ReferenceEvent(organization, reference_event_id, fields)

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
            params["group_ids"] = list(group_ids)
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
        dataset = snuba.detect_dataset(snuba_args)
        if dataset != Dataset.Events:
            raise OrganizationEventsError(
                "Invalid query. You cannot reference non-events data in this endpoint."
            )

        return snuba_args
