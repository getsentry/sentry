from __future__ import absolute_import

from sentry.api.bases.incident import IncidentPermission
from sentry.api.base import Endpoint


from sentry.tasks.data_export import compile_data


class DataExportEndpoint(Endpoint):
    permission_classes = (IncidentPermission,)

    def get(self, *args, **kwargs):
        compile_data()
        mock_response = {
            "url": "https://sentry.s3.us-east-1.amazonaws.com/{}_{}".format(
                kwargs["organization_slug"], kwargs["data_tag"]
            ),
            "expiration": "2020-11-16T23:47:29.999Z",
        }
        return self.respond(mock_response)

    def post(self, request, *args, **kwargs):
        # {
        # 	id: INT // For Postgres
        # 	data_id: STRING // For a unique identifier
        # 	org_id: STRING // For auth
        # 	user_id: STRING // Trigger an email to this user
        # 	expired_at: DATETIME // 2 days after creation
        # 	url: STRING // Link to temp storage (S3, some GGP product, etc.)
        # 	query: QUERY // Shape TBD, use this to prevent identical reqs
        # }
        # query = request.data.get('query')
        # org_id = request.data.get
        # print(request.data.get)
        return self.respond("This endpoint will be used to begin CSV generation.")
