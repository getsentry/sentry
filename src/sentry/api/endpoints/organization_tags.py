import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.utils.numbers import format_grouped_length
from sentry.utils.sdk import set_measurement


@region_silo_endpoint
class OrganizationTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.PERFORMANCE

    def get(self, request: Request, organization) -> Response:
        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="tagstore", description="get_tag_keys_for_projects"):
            with handle_query_errors():
                results = tagstore.backend.get_tag_keys_for_projects(
                    filter_params["project_id"],
                    filter_params.get("environment"),
                    filter_params["start"],
                    filter_params["end"],
                    use_cache=request.GET.get("use_cache", "0") == "1",
                    # Defaults to True, because the frontend caches these tags globally
                    include_transactions=request.GET.get("include_transactions", "1") == "1",
                    tenant_ids={"organization_id": organization.id},
                )

                # Filter out device.class from tags since it's already specified as a field in the frontend.
                # This prevents the tag from being displayed twice.
                results = [tag for tag in results if tag.key != "device.class"]

                # Setting the tag for now since the measurement is still experimental
                sentry_sdk.set_tag("custom_tags.count", len(results))
                sentry_sdk.set_tag(
                    "custom_tags.count.grouped",
                    format_grouped_length(len(results), [1, 10, 50, 100]),
                )
                set_measurement("custom_tags.count", len(results))

        return Response(serialize(results, request.user))
