from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.endpoints.api_application_details import ApiApplicationEndpoint
from sentry.api.permissions import SentryPermission
from sentry.api.serializers import serialize
from sentry.models.apiapplication import ApiApplication, generate_token


@control_silo_endpoint
class ApiApplicationRotateSecretEndpoint(ApiApplicationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = (SessionAuthentication,)
    permission_classes = (SentryPermission,)

    def post(self, request: Request, application: ApiApplication) -> Response:
        new_token = generate_token()
        application.update(client_secret=new_token)
        return Response(serialize({"clientSecret": new_token}))
