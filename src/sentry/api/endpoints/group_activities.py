from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models.activity import Activity


@region_silo_endpoint
class GroupActivitiesEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group) -> Response:
        """
        Retrieve all the Activities for a Group
        """
        activity = Activity.objects.get_activities_for_group(group, num=100)
        return Response(
            {
                "activity": serialize(activity, request.user),
            }
        )
