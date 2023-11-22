from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus, generate_token


@control_silo_endpoint
class ApiApplicationRotateSecretEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request: Request, app_id) -> Response:
        try:
            api_application = ApiApplication.objects.get(
                owner_id=request.user.id, client_id=app_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist
        new_token = generate_token()
        api_application.update(client_secret=new_token)
        return Response(serialize({"clientSecret": new_token}))
