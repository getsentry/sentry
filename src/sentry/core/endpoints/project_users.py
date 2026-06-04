from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.eventuser_endpoint_request import EventUserEndpointRequest
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectAndStaffPermission, ProjectEndpoint
from sentry.api.paginator import CallbackPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.eventuser import EventUserSerializer, EventUserSerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.eventuser import EventUser


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectUsersEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=60),
            },
        },
    )
    permission_classes = (ProjectAndStaffPermission,)

    @extend_schema(
        operation_id="List a Project's Users",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description=(
                    "Limit results to users matching the given query. Prefixes should be used "
                    "to suggest the field to match on: `id`, `email`, `username`, `ip`. "
                    "For example, `query=email:foo@example.com`."
                ),
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectUsersResponse", list[EventUserSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project) -> Response[list[EventUserSerializerResponse]]:
        """
        Return a list of users seen within this project.
        """
        analytics.record(
            EventUserEndpointRequest(
                project_id=project.id,
                endpoint="sentry.core.endpoints.project_users.get",
            )
        )
        field, identifier = None, None
        if request.GET.get("query"):
            try:
                field, identifier = request.GET["query"].strip().split(":", 1)
            except (ValueError, KeyError):
                return Response([])

        keyword_filters = {}
        if field and identifier:
            keyword_filters[field] = [identifier]

        def callback(limit, offset):
            return EventUser.for_projects(
                projects=[project],
                keyword_filters=keyword_filters,
                result_limit=limit,
                result_offset=offset,
            )

        return self.paginate(
            request=request,
            paginator_cls=CallbackPaginator,
            callback=callback,
            on_results=lambda x: serialize(x, request.user, EventUserSerializer()),
        )
