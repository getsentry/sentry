from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models.eventuser import EventUser


@region_silo_endpoint
class ProjectUserDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, user_hash) -> Response:
        analytics.record(
            "eventuser_endpoint.request",
            project_id=project.id,
            endpoint="sentry.api.endpoints.project_user_details.get",
        )
        euser = EventUser.objects.get(project_id=project.id, hash=user_hash)
        return Response(serialize(euser, request.user))

    def delete(self, request: Request, project, user_hash) -> Response:
        """
        Delete an Event User
        ````````````````````````````````

        Delete an event's user.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string user_hash: the user hash.
        """
        analytics.record(
            "eventuser_endpoint.request",
            project_id=project.id,
            endpoint="sentry.api.endpoints.project_user_details.delete",
        )
        if is_active_superuser(request):
            try:
                euser = EventUser.objects.get(project_id=project.id, hash=user_hash)
            except EventUser.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)

            euser.delete()

            return Response(status=status.HTTP_200_OK)

        else:
            return Response(status=status.HTTP_403_FORBIDDEN)
