from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.permissions import SuperuserPermission


@control_silo_endpoint
class UserPermissionsConfigEndpoint(UserEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request, user) -> Response:
        """
        List all available permissions that can be applied to a user.
        """
        return self.respond([p for p in settings.SENTRY_USER_PERMISSIONS])
