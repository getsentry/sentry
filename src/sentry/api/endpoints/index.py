from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.models.user import User


@control_silo_endpoint
class IndexEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request: Request) -> Response:
        if request.user.is_authenticated:
            user = User.objects.get(id=request.user.id)
            user = serialize(user, user)
        else:
            user = None

        if request.auth:
            auth = {"scopes": request.auth.get_scopes()}
        else:
            auth = None

        context = {"version": "0", "auth": auth, "user": user}
        return Response(context, status=200)
