import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.tagstore.base import TAG_KEY_RE


def validate_sort_field(field_name: str) -> str:
    if field_name not in ("-last_seen", "-count"):
        raise ParseError(detail="Invalid sort parameter. Please use one of: -last_seen or -count")
    return field_name


@region_silo_endpoint
class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization, key) -> Response:
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
                environment_ids = None
                if "environment_objects" in filter_params:
                    environment_ids = [env.id for env in filter_params["environment_objects"]]
                paginator = tagstore.get_tag_value_paginator_for_projects(
                    filter_params["project_id"],
                    environment_ids,
                    key,
                    filter_params["start"],
                    filter_params["end"],
                    query=request.GET.get("query"),
                    order_by=validate_sort_field(request.GET.get("sort", "-last_seen")),
                    include_transactions=request.GET.get("includeTransactions") == "1",
                    include_sessions=request.GET.get("includeSessions") == "1",
                    include_replays=request.GET.get("includeReplays") == "1",
                )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
