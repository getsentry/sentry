from __future__ import absolute_import

import sentry_sdk

from collections import defaultdict
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.snuba import discover
from sentry import features, tagstore


class OrganizationEventsFacetsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_data("organization", organization)
            if not self.has_feature(organization, request):
                return Response(status=404)
            try:
                params = self.get_filter_params(request, organization)
            except NoProjects:
                return Response([])
            params = self.quantize_date_params(request, params)
            self._validate_project_ids(request, organization, params)

        with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
            with self.handle_query_errors():
                facets = discover.get_facets(
                    query=request.GET.get("query"),
                    params=params,
                    referrer="api.organization-events-facets.top-tags",
                )

        with sentry_sdk.start_span(op="discover.endpoint", description="populate_results") as span:
            span.set_data("facet_count", len(facets or []))
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
                # Replace project ids with slugs as that is what we generally expose to users
                # and filter out projects that the user doesn't have access too.
                projects = {p.id: p.slug for p in self.get_projects(request, organization)}
                filtered_values = []
                for v in resp["project"]["topValues"]:
                    if v["value"] in projects:
                        name = projects[v["value"]]
                        v.update({"name": name})
                        filtered_values.append(v)

                resp["project"]["topValues"] = filtered_values

        return Response(resp.values())

    def _validate_project_ids(self, request, organization, params):
        project_ids = params["project_id"]

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )

        if not has_global_views and len(project_ids) > 1:
            raise ParseError(detail="You cannot view events from multiple projects.")

        return project_ids
