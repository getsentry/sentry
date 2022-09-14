from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.user import UserEndpoint
from sentry.models import UserAvatar


@control_silo_endpoint
class UserAvatarEndpoint(AvatarMixin, UserEndpoint):
    object_type = "user"
    model = UserAvatar

    def put(self, request: Request, **kwargs) -> Response:
        user = kwargs["user"]
        if user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        return super().put(request, **kwargs)
