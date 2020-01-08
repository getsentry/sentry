from __future__ import absolute_import

from collections import defaultdict
import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.snuba import discover
from sentry import features, tagstore


class OrganizationEventsFacetsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        if not features.has("organizations:events-v2", organization, actor=request.user):
            return Response(status=404)
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as error:
            raise ParseError(detail=six.text_type(error))
        except NoProjects:
            return Response({"detail": "A valid project must be included."}, status=400)
        try:
            self._validate_project_ids(request, organization, params)
        except OrganizationEventsError as error:
            return Response({"detail": six.text_type(error)}, status=400)

        try:
            facets = discover.get_facets(
                query=request.GET.get("query"),
                params=params,
                limit=20,
                referrer="api.organization-events-facets.top-tags",
            )
        except discover.InvalidSearchQuery as error:
            raise ParseError(detail=six.text_type(error))

        resp = defaultdict(lambda: {"key": "", "topValues": []})
        for row in facets:
            values = resp[row.key]
            values["key"] = tagstore.get_standardized_key(row.key)
            values["topValues"].append(
                {
                    "name": tagstore.get_tag_value_label(row.key, row.value),
                    "value": row.value,
                    "count": row.count,
                }
            )
        if "project" in resp:
            # Replace project ids with slugs as that is what we generally expose to users.
            projects = {p.id: p.slug for p in self.get_projects(request, organization)}
            for v in resp["project"]["topValues"]:
                name = projects[v["value"]]
                v.update({"name": name, "value": name})

        # TODO(mark) Figure out how to keep the results ordered.
        return Response(resp.values())

    def _validate_project_ids(self, request, organization, params):
        project_ids = params["project_id"]

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )

        if not has_global_views and len(project_ids) > 1:
            raise OrganizationEventsError("You cannot view events from multiple projects.")

        return project_ids
