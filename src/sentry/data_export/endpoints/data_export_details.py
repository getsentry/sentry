from django.http import StreamingHttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationDataExportPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.utils import metrics
from sentry.utils.compat import map

from ..models import ExportedData


class DataExportDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataExportPermission,)

    def get(self, request, organization, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """

        if not features.has("organizations:discover-query", organization):
            return Response(status=404)

        try:
            data_export = ExportedData.objects.get(id=kwargs["data_export_id"])
            # Check data export permissions
            if data_export.query_info.get("project"):
                project_ids = map(int, data_export.query_info.get("project", []))
                projects = Project.objects.filter(organization=organization, id__in=project_ids)
                if any(p for p in projects if not request.access.has_project_access(p)):
                    raise PermissionDenied(
                        detail="You don't have access to some of the data this export contains."
                    )
            # Ignore the download parameter unless we have a file to stream
            if request.GET.get("download") is not None and data_export._get_file() is not None:
                return self.download(data_export)
            return Response(serialize(data_export, request.user))
        except ExportedData.DoesNotExist:
            return Response(status=404)

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
