from __future__ import absolute_import

import sentry_sdk

from collections import defaultdict
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover
from sentry import tagstore


class OrganizationEventsFacetsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

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

        return Response(list(resp.values()))
