from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint, control_silo_endpoint


@control_silo_endpoint
class UserLoginView(Endpoint):
    owner = ApiOwner.ENTERPRISE
    permission_classes = (AllowAny,)

    def get(self, request: Request) -> Response:
        return Response({"message": "Hello world"})
