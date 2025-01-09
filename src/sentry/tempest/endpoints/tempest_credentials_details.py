from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
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

        try:
            credentials = TempestCredentials.objects.get(project=project, id=tempest_credentials_id)
        except TempestCredentials.DoesNotExist:
            raise NotFound

        data = credentials.get_audit_log_data()
        credentials.delete()

        self.create_audit_entry(
            request,
            organization=project.organization,
            target_object=credentials.id,
            event=audit_log.get_event_id("TEMPEST_CLIENT_ID_REMOVE"),
            data=data,
        )

        return Response(status=204)
