from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import UserPermission


class UserPermissionsEndpoint(UserEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request, user) -> Response:
        permission_list = list(UserPermission.objects.filter(user=user))
        return self.respond([p.permission for p in permission_list])
