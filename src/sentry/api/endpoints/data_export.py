from __future__ import absolute_import

from sentry.api.bases.incident import IncidentPermission
from sentry.api.base import Endpoint


from sentry.tasks.data_export import create_record


class DataExportEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, *args, **kwargs):
        """
        Retrieve information about the temporary file record.
        Used to populate page emailed to the user.
        """
        mock_response = {
            "url": "https://sentry.s3.us-east-1.amazonaws.com/{}_{}".format(
                kwargs["organization_slug"], kwargs["data_tag"]
            ),
            "expiration": "2020-11-16T23:47:29.999Z",
        }
        return self.respond(mock_response)

    def post(self, request, *args, **kwargs):
        """
        Route to begin the asynchronous creation of raw data
        to export. Used for Async CSV export.
        """
        create_record()
        return self.respond("This endpoint will be used to begin CSV generation.")
