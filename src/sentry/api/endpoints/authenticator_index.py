from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sentry.api.base import Endpoint
from sentry.models import Authenticator


class AuthenticatorIndexEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        """Returns u2f interface for a user, otherwise an empty array
        """

        # Currently just expose u2f challenge, not sure if it's necessary to list all
        # authenticator interfaces that are enabled
        try:
            interface = Authenticator.objects.get_interface(request.user, "u2f")
            if not interface.is_enrolled():
                raise LookupError()
        except LookupError:
            return Response([])

        challenge = interface.activate(request._request).challenge

        # I don't think we currently support multiple interfaces of the same type
        # but just future proofing I guess
        return Response([{"id": "u2f", "challenge": challenge}])
