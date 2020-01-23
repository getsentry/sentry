from __future__ import absolute_import

from rest_framework.response import Response

# from sentry import features
from sentry.api.base import Endpoint
from sentry.api.bases.incident import IncidentPermission
from sentry.api.serializers import serialize
from sentry.models import ExportedData


class DataExportDetailsEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """

        # TODO(Leander): Hide behind a feature flag
        # if not features.has("organizations:data-export", organization):
        #     return Response(status=404)

        try:
            data = ExportedData.objects.get(id=kwargs["data_id"])
            return Response(serialize(data, request.user))
        except ExportedData.DoesNotExist:
            return Response(status=404)
