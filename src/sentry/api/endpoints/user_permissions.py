from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.models import User, UserPermission


class UserPermissionsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:
        permission_list = list(UserPermission.objects.filter(user=user))
        return self.respond([p.permission for p in permission_list])
