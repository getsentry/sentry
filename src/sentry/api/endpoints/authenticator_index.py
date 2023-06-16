from base64 import b64encode

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models import Authenticator


@control_silo_endpoint
class AuthenticatorIndexEndpoint(Endpoint):
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Returns u2f interface for a user, otherwise an empty array"""

        # Currently just expose u2f challenge, not sure if it's necessary to list all
        # authenticator interfaces that are enabled
        try:
            interface = Authenticator.objects.get_interface(request.user, "u2f")
            if not interface.is_enrolled():
                raise LookupError()
        except LookupError:
            return Response([])

        challenge = interface.activate(request._request).challenge

        webAuthnAuthenticationData = b64encode(challenge)
        challenge = {}
        challenge["webAuthnAuthenticationData"] = webAuthnAuthenticationData

        # I don't think we currently support multiple interfaces of the same type
        # but just future proofing I guess
        return Response([{"id": "u2f", "challenge": challenge}])
