from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission
from sentry.api.serializers import serialize
from sentry.models import ExportedData


class DataExportDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationEventPermission,)

    def get(self, request, organization, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """

        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        try:
            data_export = ExportedData.objects.get(id=kwargs["data_id"])
            return Response(serialize(data_export, request.user))
        except ExportedData.DoesNotExist:
            return Response(status=404)
