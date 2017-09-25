from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import User


class UserPermission(ScopedPermission):
    def has_object_permission(self, request, view, user=None):
        if user is None:
            user = request.user
        if request.user == user:
            return True
        if request.auth:
            return False
        if request.is_superuser():
            return True
        return False


class UserEndpoint(Endpoint):
    permission_classes = (UserPermission, )

    def convert_args(self, request, user_id, *args, **kwargs):
        try:
            if user_id == 'me':
                if not request.user.is_authenticated():
                    raise ResourceDoesNotExist
                user_id = request.user.id

            user = User.objects.get(
                id=user_id,
            )
        except User.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs['user'] = user
        return (args, kwargs)
