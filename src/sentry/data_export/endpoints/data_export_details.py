from django.http import StreamingHttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics

from ..models import ExportedData


@region_silo_endpoint
class DataExportDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.DISCOVER_N_DASHBOARDS
    permission_classes = (OrganizationDataExportPermission,)

    def get(self, request: Request, organization: Organization, data_export_id: str) -> Response:
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """

        if not features.has("organizations:discover-query", organization):
            return Response(status=404)

        try:
            data_export = ExportedData.objects.get(id=data_export_id, organization=organization)
        except ExportedData.DoesNotExist:
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

    def download(self, data_export):
        metrics.incr("dataexport.download", sample_rate=1.0)
        file = data_export._get_file()
        raw_file = file.getfile()
        response = StreamingHttpResponse(
            iter(lambda: raw_file.read(4096), b""), content_type="text/csv"
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = f'attachment; filename="{file.name}"'
        return response
