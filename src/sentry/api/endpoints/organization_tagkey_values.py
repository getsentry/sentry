import sentry_sdk
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.tagstore.base import TAG_KEY_RE


class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, key):
        if not TAG_KEY_RE.match(key):
            return Response({"detail": f'Invalid tag key format for "{key}"'}, status=400)

        sentry_sdk.set_tag("query.tag_key", key)

        try:
            # still used by events v1 which doesn't require global views
            filter_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            paginator = SequencePaginator([])
        else:
            with self.handle_query_errors():
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
