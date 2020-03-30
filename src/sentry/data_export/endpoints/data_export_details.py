from __future__ import absolute_import

from rest_framework.response import Response
from django.http import StreamingHttpResponse

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationDataExportPermission
from sentry.api.serializers import serialize
from sentry.utils import metrics

from ..models import ExportedData


class DataExportDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDataExportPermission,)

    def get(self, request, organization, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """

        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        try:
            data_export = ExportedData.objects.get(id=kwargs["data_export_id"])
            # Ignore the download parameter unless we have a file to stream
            if request.GET.get("download") is not None and data_export.file is not None:
                return self.download(data_export)
            return Response(serialize(data_export, request.user))
        except ExportedData.DoesNotExist:
            return Response(status=404)

    def download(self, data_export):
        metrics.incr("dataexport.download", sample_rate=1.0)
        file = data_export.file
        raw_file = file.getfile()
        response = StreamingHttpResponse(
            iter(lambda: raw_file.read(4096), b""), content_type="text/csv"
        )
        response["Content-Disposition"] = u'attachment; filename="{}"'.format(file.name)
        return response
