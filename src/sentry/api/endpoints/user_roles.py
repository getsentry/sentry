from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.models.userrole import UserRole


@control_silo_endpoint
class UserUserRolesEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request, user) -> Response:
        # XXX(dcramer): we may decide to relax "view" permission over time, but being more restrictive by default
        # is preferred
        if not request.access.has_permission("users.admin"):
            return self.respond(status=403)

        role_list = list(UserRole.objects.filter(users=user))
        return self.respond(serialize(role_list, request.user))
