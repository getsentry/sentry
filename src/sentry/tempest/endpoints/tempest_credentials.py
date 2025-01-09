from django.db import IntegrityError
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.models.project import Project
from sentry.tempest.models import TempestCredentials
from sentry.tempest.permissions import TempestCredentialsPermission
from sentry.tempest.serializers import DRFTempestCredentialsSerializer, TempestCredentialsSerializer


@region_silo_endpoint
class TempestCredentialsEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.GDX

    permission_classes = (TempestCredentialsPermission,)

    def has_feature(self, request: Request, project: Project) -> bool:
        return features.has(
            "organizations:tempest-access", project.organization, actor=request.user
        )

    def get(self, request: Request, project: Project) -> Response:
        if not self.has_feature(request, project):
            raise NotFound

        tempest_credentials_qs = TempestCredentials.objects.filter(project=project)
        return self.paginate(
            request=request,
            queryset=tempest_credentials_qs,
            on_results=lambda x: serialize(x, request.user, TempestCredentialsSerializer()),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, project: Project) -> Response:
        if not self.has_feature(request, project):
            raise NotFound

        serializer = DRFTempestCredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            credentials = serializer.save(created_by_id=request.user.id, project=project)
        except IntegrityError:
            return Response(
                {"detail": "A credential with this client ID already exists."}, status=400
            )

        self.create_audit_entry(
            request,
            organization=project.organization,
            target_object=credentials.id,
            event=audit_log.get_event_id("TEMPEST_CLIENT_ID_ADD"),
            data=credentials.get_audit_log_data(),
        )

        return Response(serializer.data, status=201)
