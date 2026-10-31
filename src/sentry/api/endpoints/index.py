from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.auth.principal import require_user
from sentry.users.models.user import User


@control_silo_endpoint
class IndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = ()

    def get(self, request: Request) -> Response:
        if request.user.is_authenticated:
            user = User.objects.get(id=require_user(request).id)
            user = serialize(user, user)
        else:
            user = None

        if request.auth:
            get_stored_scopes = getattr(request.auth, "get_stored_scopes", request.auth.get_scopes)
            auth = {"scopes": get_stored_scopes()}
        else:
            auth = None

        context = {"version": "0", "auth": auth, "user": user}
        return Response(context, status=200)
