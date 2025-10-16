from rest_framework import status
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
class GroupReactionsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUE_DETECTION_BACKEND
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: AuthenticatedHttpRequest, group: Group) -> Response:
        # TODO
        # serializer = GroupReactionSerializer(
        #     data=request.data,
        #     context={
        #         "organization_id": group.organization.id,
        #         "group_id": group.id,
        #         "projects": [group.project],
        #     },
        # )
        #
        # if not serializer.is_valid():
        #     return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # validated_data = dict(serializer.validated_data)

        # in transaction
        # activity = Activity.objects.create_group_activity(
        #     group=group, type=ActivityType.NOTE, user_id=request.user.id, data=data
        # )
        # create group feedback object
        # ga.deassign()
        return Response(status=status.HTTP_201_CREATED)
