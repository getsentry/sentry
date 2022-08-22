from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.utils import authenticate_asymmetric_jwt, verify_claims
from sentry.tasks.integrations import sync_metadata
from sentry.utils import jwt

from ..integration import JiraIntegrationProvider
from .base import JiraEndpointBase


class JiraInstalledEndpoint(JiraEndpointBase):
    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)

        state = request.data
        if not state:
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        key_id = jwt.peek_header(token).get("kid")
        if key_id:
            decoded_claims = authenticate_asymmetric_jwt(token, key_id)
            verify_claims(decoded_claims, request.path, request.GET, method="POST")

        data = JiraIntegrationProvider().build_integration(state)
        integration = ensure_integration(self.provider, data)

        # Sync integration metadata from Jira. This must be executed *after*
        # the integration has been installed on Jira as the access tokens will
        # not work until then.
        sync_metadata.apply_async(kwargs={"integration_id": integration.id}, countdown=10)

        return self.respond()
