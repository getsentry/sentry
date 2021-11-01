from django.views.decorators.csrf import csrf_exempt
from rest_framework import status

from sentry.api.base import Endpoint
from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    authenticate_asymmetric_jwt,
    verify_claims,
)
from sentry.integrations.pipeline import ensure_integration
from sentry.tasks.integrations import sync_metadata
from sentry.utils import jwt

from .integration import JiraIntegrationProvider


class JiraInstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        try:
            token = request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        state = request.data
        if not state:
            return self.respond(status=status.HTTP_400_BAD_REQUEST)

        key_id = jwt.peek_header(token).get("kid")
        if key_id:
            try:
                decoded_claims = authenticate_asymmetric_jwt(token, key_id)
                verify_claims(decoded_claims, request.path, request.GET, method="POST")
            except AtlassianConnectValidationError:
                return self.respond(status=status.HTTP_400_BAD_REQUEST)

        data = JiraIntegrationProvider().build_integration(state)
        integration = ensure_integration("jira", data)

        # Sync integration metadata from Jira. This must be executed *after*
        # the integration has been installed on Jira as the access tokens will
        # not work until then.
        sync_metadata.apply_async(kwargs={"integration_id": integration.id}, countdown=10)

        return self.respond()
