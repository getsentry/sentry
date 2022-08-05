import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.serializers import serialize
from sentry.utils.numbers import format_grouped_length


class OrganizationTagsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="tagstore", description="get_tag_keys_for_projects") as span:
            with self.handle_query_errors():
                results = tagstore.get_tag_keys_for_projects(
                    filter_params["project_id"],
                    filter_params.get("environment"),
                    filter_params["start"],
                    filter_params["end"],
                    use_cache=request.GET.get("use_cache", "0") == "1",
                    # Defaults to True, because the frontend caches these tags globally
                    include_transactions=request.GET.get("include_transactions", "1") == "1",
                )
                try:
                    # Setting the tag for now since the measurement is still experimental
                    sentry_sdk.set_tag("custom_tags.count", len(results))
                    sentry_sdk.set_tag(
                        "custom_tags.count.grouped",
                        format_grouped_length(len(results), [1, 10, 50, 100]),
                    )
                    span.containing_transaction.set_measurement("custom_tags.count", len(results))
                # set_measurement is still experimental, doing this so if it changes at all we don't break this endpoint
                except Exception:
                    pass

        return Response(serialize(results, request.user))
