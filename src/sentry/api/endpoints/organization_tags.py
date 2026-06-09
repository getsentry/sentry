import datetime

import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options, tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.utils import clamp_date_range, handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.tags_examples import TagsExamples
from sentry.apidocs.parameters import GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.tagstore.types import TagKeySerializer, TagKeySerializerResponse
from sentry.utils.numbers import format_grouped_length
from sentry.utils.sdk import set_span_attribute


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.DATA_BROWSING

    @extend_schema(
        operation_id="List an Organization's Tags",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            OpenApiParameter(
                name="dataset",
                location="query",
                required=False,
                type=str,
                description="The dataset to query. Defaults to `discover`.",
                enum=["discover", "events", "search_issues", "replays"],
            ),
            OpenApiParameter(
                name="use_cache",
                location="query",
                required=False,
                type=str,
                description='Set to `"1"` to enable caching for the tag key query.',
                enum=["0", "1"],
            ),
            OpenApiParameter(
                name="useFlagsBackend",
                location="query",
                required=False,
                type=str,
                description='Set to `"1"` to query feature flags instead of tags.',
                enum=["0", "1"],
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationTagsResponse", list[TagKeySerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
        examples=[TagsExamples.ORGANIZATION_TAGS],
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[TagKeySerializerResponse]]:
        """
        Return a list of tag keys for the given organization.
        """
        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            empty: list[TagKeySerializerResponse] = []
            return Response(empty)

        if request.GET.get("dataset"):
            try:
                dataset = Dataset(request.GET.get("dataset"))
            except ValueError:
                raise ParseError(detail="Invalid dataset parameter")
        else:
            dataset = Dataset.Discover

        with sentry_sdk.start_span(op="tagstore", name="get_tag_keys_for_projects"):
            with handle_query_errors():
                start = filter_params["start"]
                end = filter_params["end"]

                if features.has("organizations:tag-key-sample-n", organization) and start and end:
                    # Tag queries longer than 14 days tend to time out for large customers. For getting a list of tags, clamping to 14 days is a reasonable compromise of speed vs. completeness
                    (start, end) = clamp_date_range(
                        (start, end),
                        datetime.timedelta(
                            days=options.get("visibility.tag-key-max-date-range.days")
                        ),
                    )

                # Flags are stored on the same table as tags but on a different column. Ideally
                # both could be queried in a single request. But at present we're not sure if we
                # want to treat tags and flags as the same or different and in which context.
                use_flag_backend = request.GET.get("useFlagsBackend") == "1"
                if use_flag_backend:
                    backend = tagstore.flag_backend
                else:
                    backend = tagstore.backend

                results = backend.get_tag_keys_for_projects(
                    filter_params["project_id"],
                    filter_params.get("environment"),
                    start,
                    end,
                    use_cache=request.GET.get("use_cache", "0") == "1",
                    dataset=dataset,
                    tenant_ids={"organization_id": organization.id},
                )

                # Filter out device.class from tags since it's already specified as a field in the frontend.
                # This prevents the tag from being displayed twice.
                final_results = []
                for tag in results:
                    if tag.key == "device.class":
                        continue
                    # the events dataset has special handling of the column "status" that breaks when users also send
                    # the tag "status". So we need to be explicit its a tag in these cases
                    elif dataset == Dataset.Events and tag.key == "status":
                        tag.key = "tags[status]"
                    final_results.append(tag)

                # Setting the tag for now since the measurement is still experimental
                sentry_sdk.set_tag("custom_tags.count", len(final_results))
                sentry_sdk.set_tag(
                    "custom_tags.count.grouped",
                    format_grouped_length(len(final_results), [1, 10, 50, 100]),
                )
                sentry_sdk.set_tag("dataset_queried", dataset.value)
                set_span_attribute("custom_tags.count", len(final_results))

        return Response(serialize(final_results, request.user, TagKeySerializer()))
