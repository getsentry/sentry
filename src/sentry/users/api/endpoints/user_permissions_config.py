from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User


@control_silo_endpoint
class UserPermissionsConfigEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request, user: User) -> Response:
        """
        List all available permissions that can be applied to a user.
        """
        return self.respond([p for p in settings.SENTRY_USER_PERMISSIONS])
