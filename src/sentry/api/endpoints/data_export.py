from __future__ import absolute_import

from sentry.api.bases.incident import IncidentPermission
from sentry.api.base import Endpoint


from sentry.tasks.data_export import create_record

from sentry.models import ExportedData


class DataExportEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, *args, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """
        data_record = ExportedData.objects.get(data_id=kwargs["data_id"])
        return self.respond(data_record.get_storage_info())

    def post(self, request, *args, **kwargs):
        """
        Route to begin the asynchronous creation of raw data
        to export. Used for Async CSV export.
        """
        create_record()
        return self.respond("This endpoint will be used to begin CSV generation.")
