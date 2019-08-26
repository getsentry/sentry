from __future__ import absolute_import

import six

from rest_framework.response import Response
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.utils.snuba import get_snuba_column_name, raw_query
from sentry import features, tagstore
from sentry.tagstore.base import TOP_VALUES_DEFAULT_LIMIT


# If the requested key is project.name, we get the distribution by project.id
# from Snuba and convert those values back to names
PROJECT_KEY = "project.name"


class OrganizationEventsDistributionEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        if not features.has("organizations:events-v2", organization, actor=request.user):
            return Response(status=404)
        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            return Response({"detail": "A valid project must be included."}, status=400)

        try:
            key = self._validate_key(request)
            self._validate_project_ids(request, organization, snuba_args)
        except OrganizationEventsError as error:
            return Response({"detail": six.text_type(error)}, status=400)

        if key == PROJECT_KEY:
            colname = "project_id"
            conditions = snuba_args["conditions"]
        else:
            colname = get_snuba_column_name(key)
            conditions = snuba_args["conditions"] + [[colname, "IS NOT NULL", None]]

        top_values = raw_query(
            start=snuba_args["start"],
            end=snuba_args["end"],
            conditions=conditions,
            filter_keys=snuba_args["filter_keys"],
            groupby=[colname],
            aggregations=[("count()", None, "count")],
            orderby="-count",
            limit=TOP_VALUES_DEFAULT_LIMIT,
            referrer="api.organization-events-distribution",
        )["data"]

        projects = {p.id: p.slug for p in self.get_projects(request, organization)}

        if key == PROJECT_KEY:
            resp = {
                "key": PROJECT_KEY,
                "topValues": [
                    {
                        "value": projects[v["project_id"]],
                        "name": projects[v["project_id"]],
                        "count": v["count"],
                    }
                    for v in top_values
                ],
            }
        else:
            resp = {
                "key": key,
                "topValues": [
                    {
                        "value": v[colname],
                        "name": tagstore.get_tag_value_label(colname, v[colname]),
                        "count": v["count"],
                    }
                    for v in top_values
                ],
            }

        return Response(resp)

    def _validate_key(self, request):
        key = request.GET.get("key")

        if not key:
            raise OrganizationEventsError("Tag key must be specified.")

        if not tagstore.is_valid_key(key):
            raise OrganizationEventsError("Tag key %s is not valid." % key)

        return key

    def _validate_project_ids(self, request, organization, snuba_args):
        project_ids = snuba_args["filter_keys"]["project_id"]

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )

        if not has_global_views and len(project_ids) > 1:
            raise OrganizationEventsError("You cannot view events from multiple projects.")

        return project_ids
