import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupactionlogentry import get_serialized_activity_items
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.action_log.read_metrics import activity_read_endpoint
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.activity import Activity
from sentry.models.group import Group

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class GroupActivitiesEndpoint(GroupEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @deprecated(
        CELL_API_DEPRECATION_DATE,
        suggested_api="sentry-api-0-organization-group-group-activities",
        url_names=["sentry-api-0-group-activities"],
    )
    def get(self, request: Request, group: Group) -> Response:
        """
        Retrieve all the Activities for a Group
        """
        activity_items = get_serialized_activity_items(
            group, request.user, endpoint=activity_read_endpoint(request)
        )
        if activity_items is not None:
            return Response({"activity": activity_items})

        activity = Activity.objects.get_activities_for_group(group, num=100)
        return Response(
            {
                "activity": serialize(activity, request.user),
            }
        )
