from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.tagstore.base import TAG_KEY_RE
from sentry import tagstore


class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, key):
        if not TAG_KEY_RE.match(key):
            return Response({"detail": 'Invalid tag key format for "%s"' % (key,)}, status=400)

        try:
            filter_params = self.get_snuba_params(request, organization)
        except NoProjects:
            paginator = SequencePaginator([])
        else:
            paginator = tagstore.get_tag_value_paginator_for_projects(
                filter_params["project_id"],
                filter_params.get("environment"),
                key,
                filter_params["start"],
                filter_params["end"],
                query=request.GET.get("query"),
                include_transactions=request.GET.get("includeTransactions") == "1",
            )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
