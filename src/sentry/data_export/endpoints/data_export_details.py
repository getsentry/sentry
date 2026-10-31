from typing import Any

from django.http import StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.exporteddata import ExportedDataResponse
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import owned_by_acting_user
from sentry.data_export.models import ExportedData
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics

DATA_EXPORT_ID_PARAM = OpenApiParameter(
    name="data_export_id",
    location="path",
    required=True,
    type=int,
    description="The ID of the data export.",
)

DOWNLOAD_PARAM = OpenApiParameter(
    name="download",
    location="query",
    required=False,
    type=str,
    description=(
        "If present and the export file is ready, the response is the exported file "
        "instead of JSON metadata. Any value (including empty) triggers the download."
    ),
)


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class DataExportDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (OrganizationDataExportPermission,)

    def convert_args(
        self, request: Request, data_export_id: str, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        kwargs["data_export_id"] = to_valid_int_id("data_export_id", data_export_id, raise_404=True)
        return args, kwargs

    @extend_schema(
        operation_id="Retrieve a Data Export",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, DATA_EXPORT_ID_PARAM, DOWNLOAD_PARAM],
        responses={
            200: inline_sentry_response_serializer("ExportedDataResponse", ExportedDataResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, data_export_id: int
    ) -> Response | StreamingHttpResponse:
        """
        Retrieve the status and metadata of a data export created by the requesting user.
        Pass the `download` query parameter to download the exported file once it is ready.
        """
        try:
            data_export = ExportedData.objects.get(
                owned_by_acting_user(request.user), id=data_export_id, organization=organization
            )
        except ExportedData.DoesNotExist:
            if ExportedData.objects.filter(id=data_export_id, organization=organization).exists():
                metrics.incr("dataexport.details.cross_user_access", sample_rate=1.0)
            return Response(status=404)
        # Check data export permissions
        if data_export.query_info.get("project"):
            project_ids = [int(project) for project in data_export.query_info.get("project", [])]
            projects = Project.objects.filter(organization=organization, id__in=project_ids)
            if any(p for p in projects if not request.access.has_project_access(p)):
                raise PermissionDenied(
                    detail="You don't have permissions to view some of the data this export contains."
                )
        # Ignore the download parameter unless we have a file to stream
        if request.GET.get("download") is not None and data_export._get_file() is not None:
            return self.download(data_export)
        return Response(serialize(data_export, request.user))

    def download(self, data_export: ExportedData) -> StreamingHttpResponse:
        metrics.incr("dataexport.download", sample_rate=1.0)
        file = data_export._get_file()
        assert file is not None
        raw_file = file.getfile()
        content_type = file.headers.get("Content-Type", "text/csv")
        response = StreamingHttpResponse(
            iter(lambda: raw_file.read(4096), b""), content_type=content_type
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = f'attachment; filename="{file.name}"'
        return response
