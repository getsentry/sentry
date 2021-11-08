from django.conf import settings

from sentry.api.bases.user import UserEndpoint


class UserPermissionsConfigEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        List all available permissions that can be applied to a user.
        """
        return self.respond([p for p in settings.SENTRY_USER_PERMISSIONS])
