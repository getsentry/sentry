from base64 import b64encode

from rest_framework.permissions import IsAuthenticated  # noqa S012
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.auth.authenticators.base import ActivationChallengeResult
from sentry.users.models.authenticator import Authenticator


@control_silo_endpoint
class AuthenticatorIndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
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

        activation_result = interface.activate(request._request)
        assert isinstance(activation_result, ActivationChallengeResult)
        challenge_bytes = activation_result.challenge

        webAuthnAuthenticationData = b64encode(challenge_bytes)
        challenge = {}
        challenge["webAuthnAuthenticationData"] = webAuthnAuthenticationData

        # I don't think we currently support multiple interfaces of the same type
        # but just future proofing I guess
        return Response([{"id": "u2f", "challenge": challenge}])
