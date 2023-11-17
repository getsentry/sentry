from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import CallbackPaginator, DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models.eventuser import EventUser as EventUser_model
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.eventuser import EventUser

QUERY_TO_SNUBA_FIELD_MAPPING = {
    "id": "user_id",
    "username": "user_name",
    "email": "user_email",
    "ip": ["ip_address_v4", "ip_address_v6"],
}

REFERRER = "sentry.api.endpoints.project_users"


@region_silo_endpoint
class ProjectUsersEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    rate_limits = {
        "GET": {
            RateLimitCategory.ORGANIZATION: RateLimit(5, 60),
        },
    }

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Users
        ``````````````````````

        Return a list of users seen within this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        :qparam string query: Limit results to users matching the given query.
                              Prefixes should be used to suggest the field to
                              match on: ``id``, ``email``, ``username``, ``ip``.
                              For example, ``query=email:foo@example.com``
        """
        analytics.record(
            "eventuser_endpoint.request",
            project_id=project.id,
            endpoint="sentry.api.endpoints.project_users.get",
        )
        field, identifier = None, None
        if request.GET.get("query"):
            try:
                field, identifier = request.GET["query"].strip().split(":", 1)
            except (ValueError, KeyError):
                return Response([])

        if not features.has("organizations:eventuser-from-snuba", project.organization):
            queryset = EventUser_model.objects.filter(project_id=project.id)
            if field and identifier:
                queryset = queryset.filter(
                    project_id=project.id,
                    **{EventUser_model.attr_from_keyword(field): identifier},
                )

            return self.paginate(
                request=request,
                queryset=queryset,
                order_by="-date_added",
                paginator_cls=DateTimePaginator,
                on_results=lambda x: serialize(x, request.user),
            )
        else:
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
                on_results=lambda x: serialize(x, request.user),
            )
