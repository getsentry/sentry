from __future__ import absolute_import

from sentry import features
from sentry.api.base import Endpoint
from sentry.api.bases.incident import IncidentPermission
from sentry.models import ExportedData


from django.http import Http404


class DataExportEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, organization, *args, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """
        if not features.has("organizations:data-export", organization):
            raise Http404()
        try:
            export_record = ExportedData.objects.get(id=kwargs["data_id"])
            return self.respond(export_record.get_storage_info())
        except ExportedData.DoesNotExist:
            raise Http404()
