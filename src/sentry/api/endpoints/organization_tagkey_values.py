import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, tagstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.snuba.dataset import Dataset
from sentry.tagstore.base import TAG_KEY_RE
from sentry.tagstore.types import TagValue


def validate_sort_field(field_name: str) -> str:
    if field_name not in ("-last_seen", "-count"):
        raise ParseError(detail="Invalid sort parameter. Please use one of: -last_seen or -count")
    return field_name


@region_silo_endpoint
class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization, key) -> Response:
        if not TAG_KEY_RE.match(key):
            return Response({"detail": f'Invalid tag key format for "{key}"'}, status=400)

        sentry_sdk.set_tag("query.tag_key", key)

        dataset = None
        if request.GET.get("dataset"):
            try:
                dataset = Dataset(request.GET.get("dataset"))
                sentry_sdk.set_tag("dataset", dataset.value)
            except ValueError:
                raise ParseError(detail="Invalid dataset parameter")
        elif request.GET.get("includeTransactions") == "1":
            sentry_sdk.set_tag("dataset", Dataset.Discover.value)
        elif request.GET.get("includeReplays") == "1":
            sentry_sdk.set_tag("dataset", Dataset.Replays.value)
        else:
            sentry_sdk.set_tag("dataset", Dataset.Events.value)

        try:
            # still used by events v1 which doesn't require global views
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            paginator: SequencePaginator[TagValue] = SequencePaginator([])
        else:
            with handle_query_errors():
                # Flags are stored on the same table as tags but on a different column. Ideally
                # both could be queried in a single request. But at present we're not sure if we
                # want to treat tags and flags as the same or different and in which context.
                if request.GET.get("useFlagsBackend") == "1" and features.has(
                    "organizations:feature-flag-autocomplete", organization, actor=request.user
                ):
                    backend = tagstore.flag_backend
                else:
                    backend = tagstore.backend

                paginator = backend.get_tag_value_paginator_for_projects(
                    snuba_params.project_ids,
                    snuba_params.environment_ids,
                    key,
                    snuba_params.start_date,
                    snuba_params.end_date,
                    dataset=dataset,
                    query=request.GET.get("query"),
                    order_by=validate_sort_field(request.GET.get("sort", "-last_seen")),
                    include_transactions=request.GET.get("includeTransactions") == "1",
                    include_sessions=request.GET.get("includeSessions") == "1",
                    include_replays=request.GET.get("includeReplays") == "1",
                    tenant_ids={"organization_id": organization.id},
                )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
