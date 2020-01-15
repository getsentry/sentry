from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.incident import IncidentPermission
from sentry.api.base import Endpoint


from sentry.tasks.data_export import compile_data


class DataExportEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, *args, **kwargs):
        compile_data()
        mock_response = {
            # 'data_id': kwargs['data_tag'],
            # 'org_id': kwargs['organization_slug'],
            # 'user_id': 'user@email.com',
            "url": "https://sentry.s3.us-east-1.amazonaws.com/{}".format(kwargs["data_tag"]),
            "expiration": "2020-11-16T23:59:59.999Z",
        }
        return Response(mock_response)
