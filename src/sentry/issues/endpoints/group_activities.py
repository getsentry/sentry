import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupactionlogentry import serialize_first_seen_entry
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
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
        if features.has("projects:issue-action-log-activity", group.project, actor=request.user):
            action_log = GroupActionLogEntry.objects.get_actions_for_group(group, 99)
            if action_log:
                serialized = serialize(action_log, request.user)
                serialized.append(serialize_first_seen_entry(group))
                return Response(
                    {
                        "activity": serialized,
                    }
                )
            logger.info(
                "group_activities.groupactionlogentry.not_found", extra={"group_id": group.id}
            )

        activity = Activity.objects.get_activities_for_group(group, num=100)
        return Response(
            {
                "activity": serialize(activity, request.user),
            }
        )
