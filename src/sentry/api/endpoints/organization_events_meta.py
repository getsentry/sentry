from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.base import EnvironmentMixin
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.models import Group, GroupStatus
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.snuba import discover


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)
        except NoProjects:
            return Response({"count": 0})

        try:
            result = discover.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

        return Response({"count": result["data"][0]["count"]})


class OrganizationEventsRelatedIssuesEndpoint(OrganizationEventsEndpointBase, EnvironmentMixin):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)
        except NoProjects:
            return Response([])

        possible_keys = ["transaction"]
        lookup_keys = {key: request.query_params.get(key) for key in possible_keys}

        if not any(lookup_keys.values()):
            return Response(
                {
                    "detail": "Must provide one of {} in order to find related events".format(
                        possible_keys
                    )
                },
                status=400,
            )

        groups = []
        try:
            results = discover.get_related_issues(params=params, lookup_keys=lookup_keys)
            group_ids = [r["group_id"] for r in results]
            groups = Group.objects.filter(
                id__in=group_ids,
                project_id__in=params["project_id"],
                status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED, GroupStatus.IGNORED],
            )
        except discover.InvalidSearchQuery as err:
            raise ParseError(detail=six.text_type(err))

        context = serialize(
            list(groups),
            request.user,
            GroupSerializer(environment_func=self._get_environment_func(request, organization.id)),
        )

        return Response(context)
