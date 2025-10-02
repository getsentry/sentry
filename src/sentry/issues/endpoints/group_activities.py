from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import CursorPaginator
from sentry.api.serializers import serialize
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group


@region_silo_endpoint
class GroupActivitiesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve Activities for a Group with pagination support

        :qparam int limit: number of activities to return (default: 100)
        :qparam string cursor: cursor for pagination
        """
        # Get limit from query params, default to 100, max 1000
        try:
            limit = min(int(request.GET.get("limit", 100)), 1000)
        except (ValueError, TypeError):
            limit = 100

        # Use cursor parameter if provided for pagination
        cursor = request.GET.get("cursor")

        if cursor:
            # Use cursor-based pagination for consistent results
            queryset = Activity.objects.filter(group=group).order_by("-datetime")
            return self.paginate(
                request=request,
                queryset=queryset,
                paginator_cls=CursorPaginator,
                on_results=lambda x: {"activity": serialize(x, request.user)},
            )
        else:
            # Backward compatibility: return activities using the existing method
            activity = Activity.objects.get_activities_for_group(group, num=limit)
            return Response(
                {
                    "activity": serialize(activity, request.user),
                }
            )
