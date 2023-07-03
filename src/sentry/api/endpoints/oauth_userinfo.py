from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models import ApiToken


@control_silo_endpoint
class OAuthUserInfoEndpoint(Endpoint):
    permission_classes: tuple = ()

    def get(self, request: Request) -> Response:
        if "HTTP_ACCESS_TOKEN" not in request.META:
            return Response("No access token was received.")
        access_token = request.META["HTTP_ACCESS_TOKEN"]
        token_details = ApiToken.objects.get(token=access_token)
        scopes = token_details.get_scopes()
        if "openid" not in scopes:
            return Response(status=403)
        return Response("hello, world!")
