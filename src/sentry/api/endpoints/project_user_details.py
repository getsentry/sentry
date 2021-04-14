from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.models import EventUser


class ProjectUserDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, user_hash):
        euser = EventUser.objects.get(project_id=project.id, hash=user_hash)
        return Response(serialize(euser, request.user))

    def delete(self, request, project, user_hash):
        """
        Delete an Event User
        ````````````````````````````````

        Delete an event's user.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string user_hash: the user hash.
        """
        if is_active_superuser(request):
            try:
                euser = EventUser.objects.get(project_id=project.id, hash=user_hash)
            except EventUser.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)

            euser.delete()

            return Response(status=status.HTTP_200_OK)

        else:
            return Response(status=status.HTTP_403_FORBIDDEN)
