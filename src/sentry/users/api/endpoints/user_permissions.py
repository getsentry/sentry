from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.permissions import SuperuserOrStaffFeatureFlaggedPermission
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User
from sentry.users.models.userpermission import UserPermission


@control_silo_endpoint
class UserPermissionsEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (SuperuserOrStaffFeatureFlaggedPermission,)

    def get(self, request: Request, user: User) -> Response:
        permission_list = list(UserPermission.objects.filter(user=user))
        return self.respond([p.permission for p in permission_list])
