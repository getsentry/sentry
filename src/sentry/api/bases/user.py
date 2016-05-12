from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import User
from sentry.models.apikey import ROOT_KEY


class UserPermission(ScopedPermission):
    def has_object_permission(self, request, view, user):
        if request.auth is ROOT_KEY:
            return True
        if request.user == user:
            return True
        if request.auth:
            return False
        if request.is_superuser():
            return True
        return False


class UserEndpoint(Endpoint):
    permission_classes = (UserPermission,)

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
