from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.models import Authenticator


class UserAuthenticatorIndexEndpoint(UserEndpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request, user):
        """Returns all interface for a user (un-enrolled ones), otherwise an empty array
        """

        interfaces = Authenticator.objects.all_interfaces_for_user(
            user, return_missing=True)
        return Response(serialize(list(interfaces)))
