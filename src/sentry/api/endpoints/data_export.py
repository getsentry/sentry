from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationEventPermission

# from sentry.models import ExportedData


class DataExportEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationEventPermission,)

    def post(self, request, organization):
        """
        Create a new Asynchronous file export task, and
        email user upon completion,
        """

        if not features.has("organizations:data-export", organization):
            return Response(status=404)

        # Create an entry in the exporteddata table
        # Trigger the celery task
        # Serialize and respond with it

        # TODO(Leander): Setup .delay reference to celery task.
        return Response(status=200)
