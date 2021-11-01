from sentry.api.bases.user import UserEndpoint
from sentry.models import UserPermission


class UserPermissionsEndpoint(UserEndpoint):
    def get(self, request, user):
        permission_list = list(UserPermission.objects.filter(user=user))
        return self.respond([p.permission for p in permission_list])
