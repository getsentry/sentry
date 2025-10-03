from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
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
        Retrieve all the Activities for a Group
        """
        activities = Activity.objects.get_activities_for_group(group)
        return Response(
            {
                "activity": serialize(activities, request.user),
            }
        )
