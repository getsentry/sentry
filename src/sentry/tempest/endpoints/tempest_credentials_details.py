from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.models.project import Project
from sentry.tempest.models import TempestCredentials
from sentry.tempest.permissions import TempestCredentialsPermission


@region_silo_endpoint
class TempestCredentialsDetailsEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.GDX

    permission_classes = (TempestCredentialsPermission,)

    def has_feature(self, request: Request, project: Project) -> bool:
        return features.has(
            "organizations:tempest-access", project.organization, actor=request.user
        )

    def delete(self, request: Request, project: Project, tempest_credentials_id: int) -> Response:
        if not self.has_feature(request, project):
            raise NotFound

        TempestCredentials.objects.filter(project=project, id=tempest_credentials_id).delete()
        return Response(status=204)
