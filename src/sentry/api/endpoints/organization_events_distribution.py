from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry import features, tagstore
from sentry.snuba import discover
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
        except OrganizationEventsError as error:
            raise ParseError(detail=six.text_type(error))
        except NoProjects:
            return Response({"detail": "A valid project must be included."}, status=400)

        try:
            key = self._validate_key(request)
            self._validate_project_ids(request, organization, params)
        except OrganizationEventsError as error:
            raise ParseError(detail=six.text_type(error))

        if key == PROJECT_KEY:
            colname = "project.id"
        elif key == "user":
            colname = "sentry:user"
        else:
            colname = key
        try:
            result = discover.query(
                selected_columns=[colname, "count()"],
                params=params,
                query=request.GET.get("query"),
                orderby="-count",
                limit=TOP_VALUES_DEFAULT_LIMIT,
                referrer="api.organization-events-distribution",
            )
        except discover.InvalidSearchQuery as error:
            raise ParseError(detail=six.text_type(error))

        if key == PROJECT_KEY:
            projects = {p.id: p.slug for p in self.get_projects(request, organization)}
            resp = {
                "key": PROJECT_KEY,
                "topValues": [
                    {
                        "value": projects[v["project.id"]],
                        "name": projects[v["project.id"]],
                        "count": v["count"],
                    }
                    for v in result["data"]
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
                    for v in result["data"]
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

    def _validate_project_ids(self, request, organization, params):
        project_ids = params["project_id"]

        has_global_views = features.has(
            "organizations:global-views", organization, actor=request.user
        )

        if not has_global_views and len(project_ids) > 1:
            raise OrganizationEventsError("You cannot view events from multiple projects.")

        return project_ids
