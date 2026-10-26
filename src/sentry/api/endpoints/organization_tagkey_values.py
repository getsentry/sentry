import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.snuba.dataset import Dataset
from sentry.tagstore.base import TAG_KEY_RE
from sentry.tagstore.types import TagValue, TagValueSerializerResponse


def validate_sort_field(field_name: str) -> str:
    if field_name not in ("-last_seen", "-count"):
        raise ParseError(detail="Invalid sort parameter. Please use one of: -last_seen or -count")
    return field_name


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="listOrganizationTagValues",
        summary="List an Organization's Tag Values",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            OpenApiParameter(
                name="key",
                location="path",
                required=True,
                type=str,
                description="The tag key to look up.",
            ),
            OpenApiParameter(
                name="dataset",
                location="query",
                required=False,
                type=str,
                description="The dataset to query. Defaults to `events`.",
                enum=["discover", "events", "search_issues", "replays"],
            ),
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description='Perform a "contains" match on the tag values.',
            ),
            OpenApiParameter(
                name="sort",
                location="query",
                required=False,
                type=str,
                description="The sort order of the values. Defaults to `-last_seen`. Use `-count` to rank by how often each value occurs.",
                enum=["-last_seen", "-count"],
            ),
            OpenApiParameter(
                name="useFlagsBackend",
                location="query",
                required=False,
                type=str,
                description='Set to `"1"` when `key` names a feature flag rather than a tag. Flags are stored alongside tags but in a separate column, so a flag key looked up as a tag returns no values.',
                enum=["0", "1"],
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationTagValuesResponse", list[TagValueSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization, key
    ) -> Response[list[TagValueSerializerResponse]] | Response[DetailResponse]:
        """
        Return a list of values associated with this tag key across the organization's
        projects. The `query` parameter can be used to perform a "contains" match on
        values.
        """
        if not TAG_KEY_RE.match(key):
            return Response({"detail": f'Invalid tag key format for "{key}"'}, status=400)

        sentry_sdk.set_tag("query.tag_key", key)
        sentry_sdk.set_attribute("query.tag_key", key)

        dataset = None
        if request.GET.get("dataset"):
            try:
                dataset = Dataset(request.GET.get("dataset"))
                sentry_sdk.set_tag("dataset", dataset.value)
                sentry_sdk.set_attribute("dataset", dataset.value)
            except ValueError:
                raise ParseError(detail="Invalid dataset parameter")
        elif request.GET.get("includeTransactions") == "1":
            sentry_sdk.set_tag("dataset", Dataset.Discover.value)
            sentry_sdk.set_attribute("dataset", Dataset.Discover.value)
        elif request.GET.get("includeReplays") == "1":
            sentry_sdk.set_tag("dataset", Dataset.Replays.value)
            sentry_sdk.set_attribute("dataset", Dataset.Replays.value)
        else:
            sentry_sdk.set_tag("dataset", Dataset.Events.value)
            sentry_sdk.set_attribute("dataset", Dataset.Events.value)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            paginator: SequencePaginator[TagValue] = SequencePaginator([])
        else:
            with handle_query_errors():
                # Flags are stored on the same table as tags but on a different column. Ideally
                # both could be queried in a single request. But at present we're not sure if we
                # want to treat tags and flags as the same or different and in which context.
                if request.GET.get("useFlagsBackend") == "1":
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
