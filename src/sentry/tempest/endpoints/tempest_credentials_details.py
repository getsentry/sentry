from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.models.project import Project
from sentry.tempest.models import TempestCredentials
from sentry.tempest.permissions import TempestCredentialsPermission
from sentry.tempest.utils import has_tempest_access


@region_silo_endpoint
class TempestCredentialsDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.GDX

    permission_classes = (TempestCredentialsPermission,)

    def delete(self, request: Request, project: Project, tempest_credentials_id: int) -> Response:
        if not has_tempest_access(project.organization, request.user):
            raise NotFound

        TempestCredentials.objects.filter(project=project, id=tempest_credentials_id).delete()
        return Response(status=204)
